# Etap 5 — Wdrożenia na środowiska (CD) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Wersja:** 2026-11-22 — zastępuje plan z 2026-06-17 (historia w git). Pisany do zatwierdzonej rewizji specu.

**Goal:** Pipeline CD, który podpisuje obrazy z `main`, promuje ten sam digest przez efemeryczne środowiska dev → staging → production (produkcja tylko po zielonym staging i zatwierdzeniu), z testem dymnym po każdym wdrożeniu i GitHub Release na końcu.

**Architecture:** Joby `deploy-*` w `.github/workflows/ci.yml` wywołują reużywalny `.github/workflows/deploy.yml` (`workflow_call`, wejście `environment`). Deploy: rozwiązanie digestu z `:<sha7>` → `cosign verify` (klucz + keyless) → `docker compose -f docker-compose.deploy.yml up --wait` → `scripts/smoke-test.sh` → `down -v`. Backend dostaje `SEED_ON_START`.

**Tech Stack:** GitHub Actions (reusable workflows, Environments, Deployments API), Docker Compose, GHCR, cosign v3.1.4 (Sigstore), crane v0.22.1, bash + curl + jq, Zod 4, Vitest.

**Spec:** [`docs/superpowers/specs/2026-06-17-etap5-wdrozenia-design.md`](../specs/2026-06-17-etap5-wdrozenia-design.md) · ADR: [0012](../../adr/0012-promocja-obrazu-reuzywalny-deploy.md), [0013](../../adr/0013-podpisy-obrazow-cosign.md)

## Global Constraints

- Praca na gałęzi od `main` (`git switch -c feat/etap5-cd`), bez worktree. Commity: Conventional Commits, po angielsku, stopka `Co-Authored-By` z instrukcji sesji.
- Repo: `LukasBola/dev-ops-teamable-app`; obrazy: `ghcr.io/lukasbola/teamable-backend`, `ghcr.io/lukasbola/teamable-frontend` (właściciel **małymi literami**: `${GITHUB_REPOSITORY_OWNER,,}`).
- Etykieta obrazu = pierwsze 7 znaków `git rev-parse HEAD` (`git rev-parse HEAD | cut -c1-7`, nie `--short`, które potrafi wydłużyć). Deploy zawsze po digeście `obraz@sha256:…`; nigdy `latest`.
- Środowiska: `dev` (port 8081), `staging` (8082), `production` (8083); `BETTER_AUTH_URL=http://localhost:<port>`; `COMPOSE_PROJECT_NAME=teamable_<env>`.
- Tożsamość keyless: `https://github.com/LukasBola/dev-ops-teamable-app/.github/workflows/ci.yml@refs/heads/main`, wystawca `https://token.actions.githubusercontent.com`. Klucz publiczny: `cosign.pub` w korzeniu repo.
- Sekrety nigdy w argumentach procesu ani w logach: hasła przez stdin/`env://`, `openssl … | gh secret set` (bez echa).
- Backend nie publikuje portu w `docker-compose.deploy.yml`.
- Komunikaty, komentarze, opisy testów — po polsku.
- Wersje narzędzi (sprawdzone 2026-11-22 w wydaniach na GitHubie): `sigstore/cosign-installer@v4.1.3` z `cosign-release: v3.1.4`; `imjasonh/setup-crane@v0.7` z `version: v0.22.1` (sam loguje `crane` do ghcr.io tokenem `GITHUB_TOKEN`). Pinning po SHA to Etap 6.
- cosign v3 (potwierdzone w `doc/cosign_sign.md`, `doc/cosign_verify.md` z taga v3.1.4 i w README cosign-installer): `cosign sign --yes [--key env://COSIGN_PRIVATE_KEY] <obraz@digest>`, hasło klucza z `COSIGN_PASSWORD`; `cosign verify --key cosign.pub` oraz `--certificate-identity` + `--certificate-oidc-issuer`. Dwa podpisy (kluczem i keyless) na jednym digeście to wzorzec z oficjalnego przykładu cosign-installer. v3 domyślnie zapisuje podpisy w nowym formacie bundle jako artefakty OCI 1.1 (referrers).
- Decyzja planu (spec 11 zostawia nazwy wykonawcy): re-tag `vX.Y.Z` robi osobny job `tag-release` po `check-staging`, a job `docker` na tagach jest pomijany. Dzięki temu tag na commicie niepromowalnym nie zostawia etykiety wersji w GHCR.
- Po każdym tasku zmieniającym kod: `graphify update .` (robi to też pre-commit).

## Review Focus

- **`BETTER_AUTH_URL` z ukośnikiem na końcu** (`http://localhost:8081/`): smoke musi obciąć `/` przed użyciem jako `Origin`, inaczej fałszywe 403 w kroku 4/5 → test w Task 2.
- **Hasło demo ze znakami `"`, `$`, `\`, spacją**: JSON logowania z `jq --arg`, nie sklejany w bashu → test w Task 2.
- **`DEMO_USER_EMAIL` z wielkimi literami** (`Demo@Example.com`): profil ma e-mail znormalizowany, smoke porównuje małymi literami → test w Task 2.
- **Warianty `SEED_ON_START`** (`'TRUE'`, `'1'`, `''`, brak) i produkcja bez `DEMO_*` przy `false` → testy w Task 1.
- **Tag wysłany razem z commitem** (`git push --follow-tags`): `check-staging` czerwony z czytelnym komunikatem, nie zatwierdzanie w ciemno → weryfikacja w Task 8.

---

## File Structure

| Plik | Odpowiedzialność |
|---|---|
| `backend/src/env.ts` | Schemat Zod: `SEED_ON_START` + wymóg `DEMO_*` przy `true` |
| `backend/src/index.ts` | Start: `connectDb()` → (seed) → `listen()` |
| `backend/src/__tests__/env.spec.ts` | Testy walidacji env |
| `docker-compose.deploy.yml` | Stack wdrożeniowy z obrazów po digeście |
| `scripts/smoke-test.sh` | Test dymny (5 kroków) |
| `cosign.pub` | Klucz publiczny do weryfikacji podpisu kluczem |
| `.github/workflows/ci.yml` | `docker` (digest, podpisy), `deploy-dev`, `deploy-staging`, `check-staging`, `tag-release`, `deploy-production`, `release` |
| `.github/workflows/deploy.yml` | Reużywalne wdrożenie jednego środowiska |
| `README.md`, `requirements.md`, `docs/adr/0012…`, `docs/adr/0013…` | Dokumentacja i dowody |

---

### Task 1: Backend — `SEED_ON_START`

**Files:**
- Modify: `backend/src/env.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/src/__tests__/env.spec.ts`

**Interfaces:**
- Consumes: `seedDemoUser(): Promise<void>` z `backend/src/auth/demoUser.ts` (istnieje; czyta `DEMO_USER_*` z `process.env`).
- Produces: `Env.SEED_ON_START: boolean` (domyślnie `false`); zmienne env konsumowane przez obraz: `SEED_ON_START`, `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD`.

- [ ] **Step 1: Dopisz testy do `describe('parseEnv')` w `env.spec.ts`** (obiekt `valid` już jest w pliku)

```ts
it('SEED_ON_START domyślnie false; puste = false', () => {
  expect(parseEnv(valid).SEED_ON_START).toBe(false)
  expect(parseEnv({ ...valid, SEED_ON_START: '' }).SEED_ON_START).toBe(false)
})

it('SEED_ON_START rozumie true/TRUE/1 i false', () => {
  const demo = { DEMO_USER_EMAIL: 'demo@example.com', DEMO_USER_PASSWORD: 'haslo-demo-123' }
  expect(parseEnv({ ...valid, ...demo, SEED_ON_START: 'true' }).SEED_ON_START).toBe(true)
  expect(parseEnv({ ...valid, ...demo, SEED_ON_START: 'TRUE' }).SEED_ON_START).toBe(true)
  expect(parseEnv({ ...valid, ...demo, SEED_ON_START: '1' }).SEED_ON_START).toBe(true)
  expect(parseEnv({ ...valid, SEED_ON_START: 'false' }).SEED_ON_START).toBe(false)
})

it('rzuca dla nieprawidłowej wartości SEED_ON_START', () => {
  expect(() => parseEnv({ ...valid, SEED_ON_START: 'może' })).toThrow(/SEED_ON_START/)
})

it('SEED_ON_START=true bez danych demo rzuca i wymienia brakujące pole', () => {
  expect(() => parseEnv({ ...valid, SEED_ON_START: 'true' })).toThrow(/DEMO_USER_EMAIL/)
  expect(() =>
    parseEnv({ ...valid, SEED_ON_START: 'true', DEMO_USER_EMAIL: 'demo@example.com' }),
  ).toThrow(/DEMO_USER_PASSWORD/)
})

it('SEED_ON_START=false nie wymaga danych demo (produkcja)', () => {
  expect(() => parseEnv({ ...valid, SEED_ON_START: 'false' })).not.toThrow()
})
```

- [ ] **Step 2: Uruchom — oczekiwane FAIL**

Run: `cd backend && npx vitest run src/__tests__/env.spec.ts` (wymaga Dockera: globalSetup podnosi Mongo)
Expected: FAIL — `SEED_ON_START` to `undefined`, brak błędów walidacji.

- [ ] **Step 3: Rozszerz schemat w `backend/src/env.ts`**

Pole `SEED_ON_START: z.stringbool().default(false)` (Zod 4.6.7 w repo: `'TRUE'`, `'1'`, `'yes'` → `true`; `'może'` → błąd — sprawdzone). Na obiekcie `.superRefine`: gdy `SEED_ON_START` i brak `DEMO_USER_EMAIL` → issue `path: ['DEMO_USER_EMAIL']`, analogicznie `DEMO_USER_PASSWORD`; komunikat: `wymagane przy SEED_ON_START=true`. `parseEnv` bez zmian (składa ścieżkę i komunikat). `Env` nadal `z.infer<typeof schema>`.

- [ ] **Step 4: Uruchom — oczekiwane PASS**

Run: `cd backend && npx vitest run src/__tests__/env.spec.ts`
Expected: PASS (wszystkie testy pliku).

- [ ] **Step 5: Wywołaj seed w `backend/src/index.ts`**

W `main()`: `const { PORT: port, SEED_ON_START } = env()`; po `await connectDb()`, przed `createApp().listen(...)`: `if (SEED_ON_START) { await seedDemoUser(); console.log(\`Konto demo gotowe: ${process.env.DEMO_USER_EMAIL}\`) }`. Import z `./auth/demoUser.js`. Błąd seeda leci do istniejącego `main().catch` → `exit 1` (tak ma być: kontener padnie, `up --wait` się zaczerwieni).

- [ ] **Step 6: Pełne testy, typy, lint backendu**

Run: `cd backend && npm run type-check && npm run lint && npx prettier --check src && npm test`
Expected: wszystko zielone (w tym `layers.spec.ts` — `index.ts` może importować z `auth/`).

- [ ] **Step 7: Commit**

```bash
git add backend/src/env.ts backend/src/index.ts backend/src/__tests__/env.spec.ts
git commit -m "feat(backend): seed demo account on start when SEED_ON_START is set"
```

---

### Task 2: Compose wdrożeniowy i test dymny (lokalnie)

**Files:**
- Create: `docker-compose.deploy.yml`
- Create: `scripts/smoke-test.sh` (wykonywalny)

**Interfaces:**
- Consumes: obraz backendu z Task 1 (lokalnie budowany).
- Produces: compose czytający `BACKEND_IMAGE`, `FRONTEND_IMAGE`, `FRONTEND_PORT`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SEED_ON_START`, `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD`; skrypt `scripts/smoke-test.sh <BASE_URL>` czytający `SMOKE_LOGIN` (`true` → krok 5), `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD`; kod wyjścia 0 = OK, ≠0 = błąd z komunikatem `Smoke FAIL: <krok>` na stderr.

- [ ] **Step 1: Napisz `docker-compose.deploy.yml`** wg specu, sekcja 3: `image: ${BACKEND_IMAGE:?ustaw BACKEND_IMAGE}` / `${FRONTEND_IMAGE:?…}`, `ports: ["${FRONTEND_PORT:?…}:80"]` tylko dla frontendu, healthchecki mongo i backend skopiowane z `docker-compose.yml` (mongosh ping; `wget -qO- http://localhost:3000/api/health`; 10s/5s/5), wolumeny `mongo-data` i `uploads:/app/data/uploads`, zmienne backendu jak w specu (`MONGODB_URI: mongodb://mongo:27017/teamable`, wymagane `:?`, opcjonalne `:-`).

- [ ] **Step 2: Napisz `scripts/smoke-test.sh`**

`#!/usr/bin/env bash`, `set -euo pipefail`. `BASE="${1:?Użycie: smoke-test.sh <BASE_URL>}"; BASE="${BASE%/}"`. Plik ciasteczek `mktemp` + `trap 'rm -f "$JAR"' EXIT`. Pomocnik `status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }`; każdy krok kończy się `fail "<krok>"` (stderr + `exit 1`) przy złej odpowiedzi. Kroki 1–5 dokładnie jak w specu, sekcja 6:

1. `curl -fsS --retry 10 --retry-connrefused --retry-delay 2 "$BASE/api/health"` zawiera `"status":"ok"`.
2. `curl -fsS "$BASE/"` zawiera `<div id="app">`.
3. `status "$BASE/api/profile"` == `401`.
4. Logowanie nieistniejącym kontem `smoke-nobody@example.com` / `zle-haslo-123` z `-H "Origin: $BASE"` → `401` (403 = „BETTER_AUTH_URL nie zgadza się z adresem aplikacji”).
5. Gdy `SMOKE_LOGIN` == `true`: logowanie demo z zapisem ciasteczek, potem `curl -fsS -b "$JAR" "$BASE/api/profile" | jq -r .email` == `DEMO_USER_EMAIL` małymi literami (`${DEMO_USER_EMAIL,,}`).

Ciało logowania (krok 4 i 5) zawsze tak — hasło nie trafia do argv:

```bash
jq -n --arg email "$EMAIL" --arg password "$PASSWORD" '{email: $email, password: $password}' \
  | curl … -H 'Content-Type: application/json' -H "Origin: $BASE" --data @- "$BASE/api/auth/sign-in/email"
```

Na końcu `echo "Smoke OK: $BASE"`. `chmod +x scripts/smoke-test.sh`.

- [ ] **Step 3: Lint skryptu**

Run: `brew install shellcheck && shellcheck scripts/smoke-test.sh`
Expected: brak ostrzeżeń.

- [ ] **Step 4: Podnieś stack lokalnie (obraz backendu z Task 1, frontend z GHCR)**

```bash
docker build -t teamable-backend:local backend
export BACKEND_IMAGE=teamable-backend:local
export FRONTEND_IMAGE=ghcr.io/lukasbola/teamable-frontend:latest   # lokalnie etykieta wystarczy; digest wstawia dopiero deploy.yml
export COMPOSE_PROJECT_NAME=teamable_local COMPOSE_FILE=docker-compose.deploy.yml FRONTEND_PORT=8081
export BETTER_AUTH_URL=http://localhost:8081/ SEED_ON_START=true
export DEMO_USER_EMAIL='Demo@Example.com' DEMO_USER_PASSWORD='Ha"s$lo \demo 123'
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
docker compose up -d --wait
```

Expected: `docker compose ps` — mongo i backend `healthy`, frontend `running`; `docker compose port backend 3000` nic nie zwraca (brak portu). Uwaga: `BETTER_AUTH_URL` celowo z `/` na końcu, e-mail z wielkimi literami, hasło ze znakami specjalnymi (Review Focus 1–3). Jeśli backend nie akceptuje URL-a z ukośnikiem, użyj `http://localhost:8081` w env backendu i `http://localhost:8081/` tylko jako argumentu skryptu.

- [ ] **Step 5: Ścieżka pozytywna**

Run: `SMOKE_LOGIN=true ./scripts/smoke-test.sh "$BETTER_AUTH_URL"`
Expected: `Smoke OK: http://localhost:8081`, kod 0.

- [ ] **Step 6: Kontrprzykład — zły `BETTER_AUTH_URL`**

Run: `BETTER_AUTH_URL=http://localhost:9999 docker compose up -d --wait backend && SMOKE_LOGIN=false ./scripts/smoke-test.sh http://localhost:8081`
Expected: kod ≠ 0, `Smoke FAIL` w kroku 4 (403). Potem przywróć `BETTER_AUTH_URL` i `docker compose up -d --wait backend`.

- [ ] **Step 7: Kontrprzykład — złe hasło demo w skrypcie**

Run: `DEMO_USER_PASSWORD=zle SMOKE_LOGIN=true ./scripts/smoke-test.sh http://localhost:8081`
Expected: kod ≠ 0, `Smoke FAIL` w kroku 5.

- [ ] **Step 8: Sprzątanie**

Run: `docker compose down -v`
Expected: kontenery i wolumeny `teamable_local_*` usunięte.

- [ ] **Step 9: Commit**

```bash
git add docker-compose.deploy.yml scripts/smoke-test.sh
git commit -m "feat(deploy): image-based compose stack and post-deploy smoke test"
```

---

### Task 3: Ustawienia GitHub — środowiska, sekrety, klucze cosign

> **Zmiany zewnętrzne (ustawienia repo, sekrety):** przed wykonaniem pokaż użytkownikowi listę poleceń i poczekaj na zgodę. Musi być skończony przed merge'em PR-a (spec, sekcja 4).

**Files:**
- Create: `cosign.pub`

**Interfaces:**
- Produces: Environments `dev`, `staging`, `production` z policy i zmiennymi; sekrety środowisk `BETTER_AUTH_SECRET` (×3), `DEMO_USER_PASSWORD` (dev, staging); sekrety repo `COSIGN_PRIVATE_KEY`, `COSIGN_PASSWORD`; `cosign.pub`.

- [ ] **Step 1: Środowiska z regułami** (`R=LukasBola/dev-ops-teamable-app`)

```bash
for e in dev staging; do
  echo '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' \
    | gh api -X PUT "repos/$R/environments/$e" --input -
  gh api -X POST "repos/$R/environments/$e/deployment-branch-policies" -f name=main -f type=branch
done
UID_=$(gh api user --jq .id)
echo "{\"reviewers\":[{\"type\":\"User\",\"id\":$UID_}],\"deployment_branch_policy\":{\"protected_branches\":false,\"custom_branch_policies\":true}}" \
  | gh api -X PUT "repos/$R/environments/production" --input -
gh api -X POST "repos/$R/environments/production/deployment-branch-policies" -f name='v*' -f type=tag
```

Expected: `gh api repos/$R/environments --jq '.environments[].name'` → `dev`, `production`, `staging`.

- [ ] **Step 2: Zmienne** — `gh variable set <NAZWA> --env <env> --body <wartość>` dla tabeli ze specu, sekcja 4: `FRONTEND_PORT`, `BETTER_AUTH_URL`, `SEED_ON_START` (dev/staging `true`, production `false`), `DEMO_USER_EMAIL=demo@example.com` (dev, staging).

Expected: `gh variable list --env staging` pokazuje 4 zmienne, `--env production` 3.

- [ ] **Step 3: Sekrety środowisk** — bez echa wartości:

```bash
for e in dev staging production; do openssl rand -base64 32 | gh secret set BETTER_AUTH_SECRET --env "$e"; done
for e in dev staging; do openssl rand -base64 24 | gh secret set DEMO_USER_PASSWORD --env "$e"; done
```

Expected: `gh secret list --env dev` → 2 sekrety, `--env production` → 1.

- [ ] **Step 4: Para kluczy cosign** (w katalogu tymczasowym spoza repo)

```bash
brew install cosign && cosign version
cd "$(mktemp -d)" && export COSIGN_PASSWORD="$(openssl rand -base64 24)"
cosign generate-key-pair
gh secret set COSIGN_PRIVATE_KEY -R "$R" < cosign.key
printf %s "$COSIGN_PASSWORD" | gh secret set COSIGN_PASSWORD -R "$R"
cp cosign.pub <repo>/cosign.pub && rm -P cosign.key && unset COSIGN_PASSWORD
```

Expected: `gh secret list -R "$R"` zawiera `COSIGN_PRIVATE_KEY`, `COSIGN_PASSWORD`; w repo tylko `cosign.pub` (zaczyna się od `-----BEGIN PUBLIC KEY-----`).

- [ ] **Step 5: Sprawdź lokalną wersję cosign**

Run: `cosign version`
Expected: `GitVersion: v3.x` (lokalna wersja zgodna z CI v3.1.4, żeby kontrprzykłady z Task 8 weryfikowały tym samym formatem).

- [ ] **Step 6: Commit**

```bash
git add cosign.pub
git commit -m "chore(deploy): add cosign public key for image signature verification"
```

---

### Task 4: Job `docker` — digest, podpisy na `main`, pominięcie na tagach

**Files:**
- Modify: `.github/workflows/ci.yml` (job `docker`)

**Interfaces:**
- Consumes: sekrety repo `COSIGN_PRIVATE_KEY`, `COSIGN_PASSWORD` (Task 3).
- Produces: na `main` obrazy `:<sha7>` w GHCR, każdy digest podpisany keyless i kluczem; na tagach `v*` job pominięty. Niewiadoma do potwierdzenia w Task 7: czy GHCR przyjmuje podpisy v3 jako artefakty OCI 1.1 (referrers); jeśli nie, cosign ma `--registry-referrers-mode legacy` — rozstrzygnięcie trafia do ADR-0013.

- [ ] **Step 1: Zmień job `docker`**

- `if: ${{ !startsWith(github.ref, 'refs/tags/') }}`.
- `permissions`: `contents: read`, `packages: write`, `id-token: write`.
- Kroki build-push dostają `id: build-backend` / `id: build-frontend` (output `digest`).
- Po buildach, tylko `if: github.ref == 'refs/heads/main'`: `sigstore/cosign-installer@v4.1.3` (`cosign-release: v3.1.4`), potem krok podpisu z `env:` `COSIGN_PRIVATE_KEY`, `COSIGN_PASSWORD`, `BACKEND_DIGEST: ${{ steps.build-backend.outputs.digest }}`, `FRONTEND_DIGEST: …`:

```bash
owner="${GITHUB_REPOSITORY_OWNER,,}"
for ref in "ghcr.io/$owner/teamable-backend@$BACKEND_DIGEST" "ghcr.io/$owner/teamable-frontend@$FRONTEND_DIGEST"; do
  cosign sign --yes "$ref"                                  # keyless (OIDC)
  cosign sign --yes --key env://COSIGN_PRIVATE_KEY "$ref"   # kluczem
done
```

- [ ] **Step 2: Walidacja składni**

Run: `brew install actionlint && actionlint .github/workflows/ci.yml`
Expected: brak błędów.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(docker): sign pushed images with cosign keyless and key, skip on tags"
```

---

### Task 5: Reużywalny `deploy.yml` + `deploy-dev` i `deploy-staging`

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `.github/workflows/ci.yml` (nowe joby)

**Interfaces:**
- Consumes: `docker-compose.deploy.yml`, `scripts/smoke-test.sh` (Task 2), `cosign.pub` (Task 3), podpisane obrazy (Task 4), zmienne i sekrety środowisk (Task 3).
- Produces: `deploy.yml` z `on: workflow_call: inputs: environment (string, required)`; wywołanie: `uses: ./.github/workflows/deploy.yml`, `with: { environment: <env> }`, `secrets: inherit`, `permissions: { contents: read, packages: read }`. Każde udane wywołanie zostawia deployment środowiska ze statusem sukcesu (czyta go Task 6).

- [ ] **Step 1: Napisz `deploy.yml`** wg szkicu ze specu, sekcja 5: job `deploy` z `environment: ${{ inputs.environment }}`, `concurrency: { group: "deploy-${{ inputs.environment }}", cancel-in-progress: false }`, `env` z `vars.*`/`secrets.*` (jak w specu), `COMPOSE_PROJECT_NAME: teamable_${{ inputs.environment }}`, `COMPOSE_FILE: docker-compose.deploy.yml`. Kroki: checkout → `docker/login-action@v3` (ghcr.io, `github.actor`, `secrets.GITHUB_TOKEN`) → `sigstore/cosign-installer@v4.1.3` (`cosign-release: v3.1.4`) → `imjasonh/setup-crane@v0.7` (`version: v0.22.1`) → krok „Rozwiąż digesty i zweryfikuj podpisy”:

```bash
owner="${GITHUB_REPOSITORY_OWNER,,}"; sha7="$(git rev-parse HEAD | cut -c1-7)"
id="https://github.com/${GITHUB_REPOSITORY}/.github/workflows/ci.yml@refs/heads/main"
for svc in backend frontend; do
  ref="ghcr.io/$owner/teamable-$svc@$(crane digest "ghcr.io/$owner/teamable-$svc:$sha7")"
  cosign verify --key cosign.pub "$ref" > /dev/null
  cosign verify --certificate-identity "$id" \
    --certificate-oidc-issuer https://token.actions.githubusercontent.com "$ref" > /dev/null
  echo "${svc^^}_IMAGE=$ref" >> "$GITHUB_ENV"
  echo "- $svc: \`$ref\`" >> "$GITHUB_STEP_SUMMARY"
done
```

→ `docker compose pull` → `docker compose up -d --wait` → `./scripts/smoke-test.sh "$BETTER_AUTH_URL"` z `SMOKE_LOGIN: ${{ vars.SEED_ON_START }}` → `if: failure()` `docker compose logs` → `if: always()` `docker compose down -v`.

- [ ] **Step 2: Dodaj joby w `ci.yml`**: `deploy-dev` (`if: github.ref == 'refs/heads/main'`, `needs: docker`) i `deploy-staging` (`if` jak wyżej, `needs: deploy-dev`) — oba wywołują `deploy.yml` z interfejsu powyżej.

- [ ] **Step 3: Walidacja składni**

Run: `actionlint .github/workflows/ci.yml .github/workflows/deploy.yml`
Expected: brak błędów.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml .github/workflows/ci.yml
git commit -m "ci(deploy): reusable deploy workflow with signature verification, dev and staging jobs"
```

---

### Task 6: Ścieżka wydania — `check-staging`, `tag-release`, `deploy-production`, `release`

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: deploymenty środowiska `staging` (Task 5), `deploy.yml` (Task 5), obrazy `:<sha7>` (Task 4).
- Produces: na tagu `v*`: łańcuch `e2e` → `check-staging` → `tag-release` → `deploy-production` → `release`.

- [ ] **Step 1: Dodaj joby** (wszystkie z `if: startsWith(github.ref, 'refs/tags/v')`)

- `check-staging`: `needs: e2e`, `permissions: { deployments: read }`, checkout, krok z `GH_TOKEN: ${{ github.token }}`:

```bash
sha="$(git rev-parse HEAD)"
id="$(gh api "repos/$GITHUB_REPOSITORY/deployments?environment=staging&sha=$sha&per_page=1" --jq '.[0].id // empty')"
[ -n "$id" ] || { echo "::error::Brak wdrożenia staging dla $sha — najpierw main musi przejść dev i staging"; exit 1; }
state="$(gh api "repos/$GITHUB_REPOSITORY/deployments/$id/statuses?per_page=1" --jq '.[0].state // empty')"
[ "$state" = success ] || { echo "::error::Ostatnie wdrożenie staging dla $sha: '${state:-brak statusu}' — poczekaj na zielony staging i uruchom ponownie"; exit 1; }
```

- `tag-release`: `needs: check-staging`, `permissions: { contents: read, packages: write }`, checkout, `imjasonh/setup-crane@v0.7` (`version: v0.22.1`; akcja sama loguje do ghcr.io, `crane tag` dodaje etykietę do istniejącego manifestu bez pobierania — dokumentacja `crane_tag.md`); dla `backend` i `frontend`: `crane tag "$src" "$GITHUB_REF_NAME"`, gdzie `src=ghcr.io/<owner>/teamable-<svc>:<sha7>`, potem `test "$(crane digest "$src")" = "$(crane digest "${src%:*}:$GITHUB_REF_NAME")"` (ten sam digest, spec 5).
- `deploy-production`: `needs: tag-release`, wywołanie `deploy.yml` z `environment: production` (interfejs z Task 5).
- `release`: `needs: deploy-production`, `permissions: { contents: write }`, `gh release create "$GITHUB_REF_NAME" --generate-notes --verify-tag` z `GH_TOKEN`, `GH_REPO: ${{ github.repository }}`.

- [ ] **Step 2: Walidacja składni**

Run: `actionlint .github/workflows/ci.yml`
Expected: brak błędów.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(release): staging gate, version re-tag, production deploy and GitHub Release on v* tags"
```

---

### Task 7: Dokumentacja, PR i pierwszy przebieg na `main`

**Files:**
- Modify: `README.md` (nowa sekcja „Wdrożenia (Etap 5)” po „Docker (Etap 4)”)

- [ ] **Step 1: Sekcja w README** (po polsku, zwięźle): schemat przebiegu na `main` i na tagu; jak wydać wersję (`git tag vX.Y.Z` po zielonym staging; co robi czerwony `check-staging`); lista Environments/zmiennych/sekretów i odesłanie do Task 3 tego planu po polecenia; ręczna weryfikacja podpisu obrazu (`cosign verify --key cosign.pub …` i keyless z tożsamością z Global Constraints); lokalne uruchomienie `docker-compose.deploy.yml` (polecenia z Task 2, Step 4).

- [ ] **Step 2: Commit i PR**

```bash
git add README.md
git commit -m "docs(readme): CD pipeline, releases and signature verification"
git push -u origin feat/etap5-cd
gh pr create --title "feat: Etap 5 — CD with signed image promotion" --body "<opis + 🤖 stopka z instrukcji sesji>"
```

Expected: CI na PR zielone; joby `deploy-*`, `check-staging`, `tag-release`, `release` pominięte; `docker` buduje bez push i bez podpisu.

- [ ] **Step 3: Merge** — przed merge'em potwierdź z użytkownikiem i sprawdź, że Task 3 jest zrobiony (`gh api repos/$R/environments --jq '.total_count'` → 3).

- [ ] **Step 4: Weryfikacja przebiegu na `main`**

Run: `gh run watch $(gh run list --branch main --limit 1 --json databaseId --jq '.[0].databaseId')`
Expected: `docker` (z podpisami) → `deploy-dev` → `deploy-staging` zielone; w Summary każdego deployu digesty obu obrazów, te same w dev i staging; `gh api "repos/$R/deployments?environment=staging&per_page=1" --jq '.[0].sha'` == SHA merge commita.

---

### Task 8: Wydanie, kontrprzykłady i zamknięcie etapu

**Files:**
- Modify: `docs/adr/0012-promocja-obrazu-reuzywalny-deploy.md`, `docs/adr/0013-podpisy-obrazow-cosign.md`, `docs/adr/README.md`, `requirements.md`

- [ ] **Step 1: Kontrprzykład bramki staging** (Review Focus 5) — tag na starszym commicie z `main` bez wdrożenia staging, np. `17c2148`:

```bash
git tag v0.0.0-gate 17c2148 && git push origin v0.0.0-gate
```

Expected: `check-staging` czerwony z komunikatem „Brak wdrożenia staging dla …”; `tag-release` i dalsze pominięte; w GHCR brak etykiety `v0.0.0-gate`. Potem: `git push origin :refs/tags/v0.0.0-gate && git tag -d v0.0.0-gate`. Zapisz link do przebiegu.

- [ ] **Step 2: Kontrprzykłady podpisów** (lokalnie, `cosign` z Task 3):

```bash
cosign verify --key cosign.pub ghcr.io/lukasbola/teamable-backend:17c2148   # obraz sprzed podpisów
cosign verify --certificate-identity "https://github.com/LukasBola/dev-ops-teamable-app/.github/workflows/ci.yml@refs/heads/inna" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com ghcr.io/lukasbola/teamable-backend:<sha7 z Task 7>
```

Expected: oba kończą się błędem (brak podpisu; niezgodna tożsamość). Te same polecenia z poprawną tożsamością i obrazem z Task 7 — sukces.

- [ ] **Step 3: Wydanie `v0.5.0`**

```bash
git switch main && git pull && git tag v0.5.0 && git push origin v0.5.0
```

Expected: `check-staging` zielony → `tag-release` (GHCR: `:v0.5.0` z tym samym digestem co `:<sha7>`) → prośba o zatwierdzenie `production` → po zatwierdzeniu `deploy-production` zielony (smoke kroki 1–4) → `release` tworzy GitHub Release z notatkami (`gh release view v0.5.0`).

- [ ] **Step 4: Zamknij ADR-y i wymagania**

ADR-0012 i ADR-0013: status **Zaakceptowany**, w „Dowodach” SHA commitów Task 1–7 i linki do przebiegów (main, `v0.5.0`, kontrprzykład bramki); niewiadome rozstrzygnięte z datą (status deploymentu odczytany przez `check-staging`; zapis podpisów v3 w GHCR — referrers czy tryb legacy). `docs/adr/README.md`: statusy. `requirements.md`: status dokumentu v0.7 („Etap 5 — wdrożony”), 2.4 bez zmian (plan już podlinkowany).

- [ ] **Step 5: Commit i PR dokumentacji**

```bash
git switch -c docs/etap5-accept
git add docs/adr requirements.md
git commit -m "docs(adr): accept ADR-0012 and ADR-0013 with Etap 5 evidence"
git push -u origin docs/etap5-accept && gh pr create --fill
```

---

## Self-Review (wykonany przy pisaniu)

- **Pokrycie specu:** §2 → Task 1; §3 → Task 2; §4 → Task 3; §5 docker/podpisy → Task 4, deploy.yml/dev/staging → Task 5, tag/prod/release → Task 6; §6 → Task 2 (+ wywołanie w Task 5); §7 → Task 8; §8 kontrprzykłady → Task 2, 8; §9 → Task 7, 8; §10 → Task 1–8.
- **Odstępstwo od szkicu specu:** re-tag w osobnym jobie `tag-release` po `check-staging` (nie w `docker`) — opisane w Global Constraints; spec §11 zostawia nazwy i kolejność wykonawcy, kryterium „ten sam digest” zachowane.
- **Spójność nazw:** `BACKEND_IMAGE`/`FRONTEND_IMAGE` (Task 2 ↔ 5), `SMOKE_LOGIN` (Task 2 ↔ 5), `SEED_ON_START` (Task 1 ↔ 2 ↔ 3 ↔ 5), `cosign.pub` (Task 3 ↔ 5 ↔ 8).
