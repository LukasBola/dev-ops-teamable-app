# Etap 5 — Wdrożenia na środowiska (dev/staging/prod) — projekt techniczny

> **Data:** 2026-06-17 · **Rewizja:** 2026-11-22 (po Etapie 4.5, refaktorze warstw backendu i review architektonicznym)
> **Status:** zatwierdzony 2026-11-22 (gotowy do planu implementacji)
> **Źródło wymagań:** [../../../requirements.md](../../../requirements.md) (Etap 5 w sekcji 2.3, cele CD w 7.3, backlog w 2.5)
> **Decyzje:** [ADR-0012](../../adr/0012-promocja-obrazu-reuzywalny-deploy.md), [ADR-0013](../../adr/0013-podpisy-obrazow-cosign.md) (oba Proponowane) + tabela poniżej
> **Poprzedni etap:** [spec Etapu 4.5](2026-11-22-etap4-5-auth-design.md) · [spec Etapu 4](2026-06-11-etap4-docker-design.md)

## Cel i dlaczego

Projekt jest poligonem do nauki DevOps. Etap 5 ma nauczyć mechaniki **Continuous Delivery**: obraz Docker zbudowany i przetestowany raz w CI jest **podpisany** i **promowany** przez trzy środowiska (dev → staging → production). Każde środowisko ma **własną konfigurację i sekrety** (GitHub Environments), produkcja przyjmuje tylko obraz, który przeszedł staging, i wymaga **ręcznego zatwierdzenia**, a po każdym wdrożeniu **smoke test** sprawdza, czy wdrożony artefakt wstaje i czy konfiguracja środowiska jest poprawna. Wydanie wersji kończy się etykietą `vX.Y.Z` na obrazie i GitHub Release.

Wiersz Etapu 5 w `requirements.md` (2.3): _„CD, promocja artefaktów, sekrety, zmienne środowiskowe"_.

### Model środowisk: ephemeral w CI

Projekt nie ma serwera docelowego. „Wdrożenie" jest symulowane w jobie GitHub Actions: weryfikacja podpisów → pobranie obrazów z GHCR po digeście → `docker compose up` z konfiguracją środowiska → smoke test → `docker compose down -v`. Nic nie żyje poza pipeline'em.

**Co trzeba zmienić przy przejściu na trwały host (VPS)** — to nie jest „podmiana jednego kroku":

- `docker compose down -v` skasowałby bazę produkcji → na hoście tylko `up -d` (bez teardownu), wolumeny trwałe, kopie zapasowe.
- `SEED_ON_START=true` resetuje hasło demo przy każdym restarcie → na trwałym hoście seed jednorazowo albo wyłączony.
- Cofnięcie obrazu nie cofa migracji uruchamianych w `docker-entrypoint.sh` → migracje muszą być wstecznie zgodne (expand/contract).
- Dwa równoległe wdrożenia na jeden host walczą o stan → `concurrency` per środowisko (dodane już teraz, sekcja 5).
- `BETTER_AUTH_URL` z `https` (sekcja 4), sekrety na hoście zamiast w jobie.

Promocja, podpisy, Environments i smoke test zostają bez zmian [wniosek].

## Co zmieniło się od wersji z 2026-06-17

| Było w specu | Jest teraz | Powód |
|---|---|---|
| Osobny `cd.yml` na `push` do `main` (później w planie: `workflow_run`) | Joby `deploy-*` w `ci.yml` po jobie `docker`, kroki w reużywalnym `deploy.yml` | `push` ścigał się z CI (obrazu mogło jeszcze nie być); `workflow_run` wymaga wyciągania SHA z `workflow_run.head_sha`. [ADR-0012](../../adr/0012-promocja-obrazu-reuzywalny-deploy.md) |
| Production wdrażana z tagu niezależnie od wyniku staging | Job `check-staging`: produkcja rusza tylko, gdy staging dla tego SHA ma status `success` (Deployments API) | Promocja ma być wymuszona przez pipeline, a nie tylko zapisana w dokumencie; zamyka też wyścig przebiegów main/tag |
| Na tagu job `docker` buduje obrazy bez push | Na tagu: re-tag obrazu `:<sha>` → `:vX.Y.Z` bez rebuildu | Rebuild niczego nie dowodzi; etykieta wersji w GHCR wskazuje ten sam digest |
| Deploy po etykiecie `:<sha>` | Deploy po digeście (`@sha256:…`) rozwiązanym z `:<sha>`, digest w podsumowaniu joba | Etykietę da się nadpisać („Re-run" przebiegu main buduje inne bajty); podpis dotyczy digestu |
| Brak podpisów obrazów | cosign: podpis keyless (OIDC/Sigstore) **i** kluczem; deploy weryfikuje oba | Decyzja użytkownika; [ADR-0013](../../adr/0013-podpisy-obrazow-cosign.md) |
| Compose bez zmiennych auth | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DEMO_USER_*`, `SEED_ON_START` w compose | Bez nich backend nie startuje (walidacja Zod, ADR-0004) |
| Seed przez `npm run seed` (Etap 3) | `SEED_ON_START=true` → backend wywołuje `seedDemoUser()` przy starcie | Obraz nie ma `tsx` ani `scripts/seed.ts`; seed to dziś konto demo z `auth/demoUser.ts` |
| `LOG_LEVEL` per środowisko w Etapie 5 | Przeniesione do Etapu 6 (decyzja 38, pino) | Backend nie ma loggera; zmienna bez konsumenta tylko udaje różnicę między środowiskami |
| Smoke: health + `curl /` | Plus: `/api/profile` bez sesji → 401; logowanie z poprawnym originem i złym hasłem → 401 (nie 403); na dev/staging logowanie kontem demo → profil 200 | Sam health przechodzi przy złym sekrecie lub `BETTER_AUTH_URL` |
| `IMAGE_TAG` = SHA „lub `latest` dla prod" | Zawsze SHA commita (z `git rev-parse HEAD`) | `latest` łamie zasadę „ten sam artefakt" |
| Sekret `MONGODB_URI` per środowisko | Usunięty | Mongo jest w tym samym stacku; adres stały |
| `concurrency` jako nie-cel | `concurrency` per środowisko w `deploy.yml` | Dwie linie; przygotowanie pod trwały host |
| Ochrona dev/staging: brak | Deployment branch policy: tylko `main` | Warunek `if:` w YAML można zmienić na dowolnej gałęzi; polityka środowiska działa po stronie GitHuba |
| GitHub Release „opcjonalnie" | Job `release`: `gh release create --generate-notes` po udanym wdrożeniu produkcji | Decyzja użytkownika |

## Cele, nie-cele, anty-cele

**Cele**

- Ten sam obraz (ten sam digest) przechodzi dev → staging → production; wdrożenie nigdy nie buduje.
- `main` wdraża dev, potem staging (staging tylko po zielonym dev); tag `v*` wdraża production tylko wtedy, gdy staging dla tego commita był zielony, i po ręcznym zatwierdzeniu.
- Każdy obraz z `main` jest podpisany dwa razy (keyless + kluczem); wdrożenie odmawia uruchomienia obrazu bez obu ważnych podpisów.
- Konfiguracja i sekrety wyłącznie w GitHub Environments (sekrety podpisu kluczem: w sekretach repo); różnice środowisk tylko przez zmienne.
- Smoke test po każdym wdrożeniu; błąd czerwieni job i zatrzymuje promocję.
- Release: etykieta `vX.Y.Z` na obrazach i GitHub Release z notatkami z commitów.

**Nie-cele (Etap 5):** realny hosting i trwałe środowiska, rollback/blue-green/canary, Vault/SOPS, CDN, logi/metryki. Odłożone pomysły z przypisanymi etapami są w backlogu `requirements.md` 2.5 (m.in. Trivy, pinning akcji, DORA → Etap 6; Kubernetes + GitOps, atestacje, rollback, release-please → Etap 7).

**Anty-cele** (porażka, nawet jeśli pipeline jest zielony):

- obraz budowany w jobie wdrożeniowym albo inny digest na production niż na staging;
- production wdrożona mimo czerwonego staging dla tego commita;
- obraz uruchomiony bez weryfikacji podpisów albo weryfikacja, która przepuszcza podpis z innego repo/workflow;
- sekret (w tym klucz prywatny cosign) w repo, w logach joba albo w argumentach procesu;
- smoke zielony mimo błędnego `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`;
- port backendu opublikowany na hoście (obejście limitu logowań przez `X-Real-IP`, ADR-0001).

## Ograniczenia (stan zastany)

- `ci.yml`: joby `frontend`, `backend` → `e2e` → `docker`. `on: push` bez filtrów, więc uruchamia się też na tagach. Job `docker` wypycha obrazy **tylko z `main`**, etykiety: `type=sha,prefix=` (7 znaków) i `latest`. `docker/build-push-action` zwraca `digest` jako output.
- Obrazy w GHCR mają właściciela **małymi literami** (`ghcr.io/lukasbola/teamable-backend`); `github.repository_owner` to `LukasBola`. Obraz `:latest` jest publiczny — anonimowy pull manifestu zwraca 200 (sprawdzone 2026-11-22).
- Obraz backendu: `NODE_ENV=production` (limit prób logowania), `docker-entrypoint.sh` uruchamia `migrate up` przed startem, w obrazie tylko `dist/`, migracje i `migrate.cjs`; `main().catch` → `exit 1`, więc błąd seeda zatrzyma kontener i `up --wait`.
- Env walidowany Zod (`backend/src/env.ts`); puste wartości traktowane jak brak.
- `seedDemoUser()` (`backend/src/auth/demoUser.ts`): brak konta → tworzy, istnieje → ustawia hasło; zawsze nadpisuje profil demo (`email` = znormalizowany `DEMO_USER_EMAIL`).
- Logowanie: `POST /api/auth/sign-in/email` z obcym `Origin` → 403 (test `AAPI-N6`), z poprawnym originem i złym hasłem → 401 (`frontend/e2e/auth-api.spec.ts:128`). `/api/profile` bez sesji → 401 (`requireAuth`).
- Repo publiczne → required reviewers i branch policies w Environments dostępne bez płatnego planu.
- Reużywalny workflow: `environment:` ustawia job **wywoływanego** workflow; job wywołujący nie może mieć `environment:` i musi przekazać sekrety (`secrets: inherit` albo po nazwie) — dokumentacja GitHub Actions „Reuse workflows". `GITHUB_TOKEN` w wywoływanym workflow ma co najwyżej uprawnienia joba wywołującego; jawne `permissions` zerują niewymienione.
- Joby z `environment:` tworzą obiekty deployment (Deployments API) ze statusem odpowiadającym wynikowi joba [wniosek — do potwierdzenia w pierwszym przebiegu].

## Podejścia

| | Podejście | Plusy | Minusy |
|---|---|---|---|
| A | Osobny `cd.yml` na `workflow_run` po udanym CI + `push` tagu `v*` | Dwa osobne workflow: CI i CD | Plik workflow zawsze z `main`, SHA z `workflow_run.head_sha`; ścieżka tagu nie sprawdza CI |
| **B** | **Joby `deploy-*` w `ci.yml` po `docker`, kroki raz w `deploy.yml` (`workflow_call`)** | `needs` gwarantuje istnienie obrazu, `github.sha` poprawny; tag przechodzi testy przed prod; jedna definicja wdrożenia | `ci.yml` rośnie; granica CI/CD to joby, nie pliki |
| C | Jak B, kroki wklejone trzy razy | Najmniej pojęć | ~15 linii ×3 rozjedzie się przy pierwszej zmianie |

Żadne z podejść nie testuje wdrożenia na PR (joby `deploy-*` są tam pomijane) — to nie różnicuje A i B.

**Wybrane: B** (decyzja użytkownika, 2026-11-22). Szczegóły: [ADR-0012](../../adr/0012-promocja-obrazu-reuzywalny-deploy.md).

## Decyzje

Numery z `requirements.md` 8.1. Rewizja zmienia 31–37 i dodaje 56–58.

| # | Temat | Decyzja |
|---|---|---|
| 30 | Cel wdrożenia | Ephemeral w CI: verify → `pull` → `up --wait` → smoke → `down -v`. |
| 31 | Trigger i struktura CD | `main`: `docker` → `deploy-dev` → `deploy-staging`; tag `v*`: `docker` (re-tag) → `check-staging` → `deploy-production` (brama) → `release`. Kroki w reużywalnym `deploy.yml`. ([ADR-0012](../../adr/0012-promocja-obrazu-reuzywalny-deploy.md)) |
| 32 | Promowany artefakt | Ten sam obraz GHCR; deploy po digeście rozwiązanym z `:<sha>`; digest w podsumowaniu joba; deploy nigdy nie buduje. |
| 33 | Sekrety i zmienne | GitHub Environments `dev`/`staging`/`production`; dev i staging tylko z `main`, production tylko z tagów `v*` + required reviewers. |
| 34 | Dane per środowisko | dev/staging: `SEED_ON_START=true` → backend zakłada/resetuje konto demo przy starcie; production: czysty start (FR-9), konta przez CLI. |
| 35 | Flagi runtime | `SEED_ON_START` per środowisko. `LOG_LEVEL` → Etap 6 (decyzja 38). |
| 36 | Izolacja środowisk | Compose project `teamable_<env>`, port 8081/8082/8083, własny `BETTER_AUTH_URL`, `concurrency` per środowisko. |
| 37 | Smoke test | Health, SPA, `/api/profile` bez sesji → 401, logowanie z poprawnym originem i złym hasłem → 401; dev/staging dodatkowo logowanie demo → profil 200. |
| 56 | Podpisy obrazów | cosign: keyless (OIDC GitHub → Sigstore) i kluczem (para kluczy, prywatny w sekretach repo); deploy weryfikuje oba. ([ADR-0013](../../adr/0013-podpisy-obrazow-cosign.md)) |
| 57 | Release | Tag `vX.Y.Z` → re-tag obrazów bez rebuildu → (po wdrożeniu prod) `gh release create --generate-notes`. |
| 58 | Kubernetes + GitOps | Osobny **Etap 7** (Kubernetes + Argo CD); Etap 5 zostaje przy Compose. |

## 1. Pliki

```text
backend/src/env.ts                 # ZMIANA: SEED_ON_START (+ wymóg DEMO_USER_* przy true)
backend/src/index.ts               # ZMIANA: seed po connectDb(), przed listen()
backend/src/__tests__/env.spec.ts  # ZMIANA: testy SEED_ON_START
docker-compose.deploy.yml          # NOWY: stack z image: (GHCR po digeście), bez build:
.github/workflows/ci.yml           # ZMIANA: docker (digest, podpisy, re-tag), check-staging, deploy-*, release
.github/workflows/deploy.yml       # NOWY: reużywalny workflow wdrożenia (workflow_call)
scripts/smoke-test.sh              # NOWY: smoke po wdrożeniu
cosign.pub                         # NOWY: klucz publiczny do weryfikacji podpisu kluczem
README.md, requirements.md         # ZMIANA: sekcja o CD i release, 2.3/2.4/2.5, 8.1
docs/adr/0012-…, 0013-…, docs/adr/README.md
```

`docker-compose.yml` (lokalny pełny stack z `build:`) bez zmian.

## 2. Backend: `SEED_ON_START`

- `env.ts`: `SEED_ON_START` jako boolean z napisu (`z.stringbool()`), domyślnie `false`. Gdy `true`, brak `DEMO_USER_EMAIL` lub `DEMO_USER_PASSWORD` = błąd walidacji przy starcie (ten sam komunikat co reszta env).
- `index.ts`: po `connectDb()`, przed `listen()`: `if (SEED_ON_START) await seedDemoUser()`. Healthcheck zrobi się zielony dopiero po seedzie, więc smoke nie trafi na brak konta.
- Migracje biegną wcześniej (`docker-entrypoint.sh`), więc indeksy auth istnieją przed seedem.
- Testy: `env.spec.ts` (`'true'`/`'false'`/brak/wartość nieprawidłowa; `true` bez `DEMO_*` → błąd). Wywołanie w `index.ts` sprawdza smoke na dev/staging.

## 3. Compose wdrożeniowy

`docker-compose.deploy.yml` (szkic; healthchecki jak w `docker-compose.yml`):

```yaml
services:
  mongo:
    image: mongo:7
    volumes: [mongo-data:/data/db]
    healthcheck: # jak w docker-compose.yml

  backend:
    image: ${BACKEND_IMAGE:?}          # ghcr.io/lukasbola/teamable-backend@sha256:…
    environment:
      MONGODB_URI: mongodb://mongo:27017/teamable
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET:?}
      BETTER_AUTH_URL: ${BETTER_AUTH_URL:?}
      SEED_ON_START: ${SEED_ON_START:-false}
      DEMO_USER_EMAIL: ${DEMO_USER_EMAIL:-}
      DEMO_USER_PASSWORD: ${DEMO_USER_PASSWORD:-}
    volumes: [uploads:/app/data/uploads]
    depends_on: { mongo: { condition: service_healthy } }
    healthcheck: # jak w docker-compose.yml
    # BEZ ports: — backend dostępny tylko w sieci compose (X-Real-IP, ADR-0001)

  frontend:
    image: ${FRONTEND_IMAGE:?}         # ghcr.io/lukasbola/teamable-frontend@sha256:…
    ports: ["${FRONTEND_PORT:?}:80"]
    depends_on: { backend: { condition: service_healthy } }

volumes: { mongo-data: {}, uploads: {} }
```

- `image:` po digeście zamiast `build:`; `BACKEND_IMAGE`/`FRONTEND_IMAGE` ustawia job po weryfikacji podpisów, nigdy repo. Ten sam plik da się uruchomić lokalnie z digestem wpisanym ręcznie.
- `${VAR:?}` dla wartości wymaganych: brak = compose odmawia startu z czytelnym błędem, zamiast pustego sekretu.
- Nazwa projektu z `COMPOSE_PROJECT_NAME=teamable_<env>` → osobne kontenery, sieć i wolumeny.

## 4. GitHub Environments i sekrety

| Environment | Variables | Secrets | Ochrona |
|---|---|---|---|
| `dev` | `FRONTEND_PORT=8081`, `BETTER_AUTH_URL=http://localhost:8081`, `SEED_ON_START=true`, `DEMO_USER_EMAIL` | `BETTER_AUTH_SECRET`, `DEMO_USER_PASSWORD` | deployment branch policy: `main` |
| `staging` | `FRONTEND_PORT=8082`, `BETTER_AUTH_URL=http://localhost:8082`, `SEED_ON_START=true`, `DEMO_USER_EMAIL` | `BETTER_AUTH_SECRET`, `DEMO_USER_PASSWORD` | deployment branch policy: `main` |
| `production` | `FRONTEND_PORT=8083`, `BETTER_AUTH_URL=http://localhost:8083`, `SEED_ON_START=false` | `BETTER_AUTH_SECRET` | tylko tagi `v*`; required reviewers |

Sekrety repozytorium (nie środowisk, bo podpisuje job `docker`): `COSIGN_PRIVATE_KEY`, `COSIGN_PASSWORD`. Klucz publiczny `cosign.pub` w repo.

- `BETTER_AUTH_SECRET` inny w każdym środowisku (`openssl rand -base64 32`): wspólny sekret oznaczałby, że sesja z dev jest ważna na produkcji [wniosek].
- `BETTER_AUTH_URL` jest jednocześnie adresem smoke testu, więc niespójność z `FRONTEND_PORT` wyjdzie od razu.
- Realny host wymaga `https` w `BETTER_AUTH_URL` (ciasteczko sesji przez `http` w sieci publicznej da się podsłuchać) [wniosek]. Na `localhost` w jobie `http` wystarcza.
- Branch policy, a nie tylko `if:` w YAML: każda gałąź może zmienić `ci.yml` i odwołać się do `environment: staging`; polityka środowiska odrzuci taki job po stronie GitHuba.
- `secrets: inherit` przekazuje też wszystkie sekrety repo (w tym `COSIGN_*`) do `deploy.yml`, który ich nie używa [wniosek: akceptowalne w projekcie jednej osoby; alternatywa — przekazywanie po nazwie].
- Konfigurację Environments zakłada się ręcznie w Settings → Environments (lub `gh api`); kroki w README. **Environments z sekretami muszą istnieć przed merge'em PR-a z CD** — job odwołujący się do nieistniejącego środowiska tworzy je puste i pada na `${BETTER_AUTH_SECRET:?}`.
- Required reviewer na `production`: właściciel repo (jedyne konto); samodzielne zatwierdzenie dozwolone (bez „Prevent self-review") — decyzja wykonawcza, w zespole włączylibyśmy tę opcję.

## 5. Workflow

**`ci.yml` — job `docker` (zmiany)**:

- Na `main`: build + push jak dziś; z outputu `digest` każdego obrazu podpis cosign **keyless** (`permissions: id-token: write`) i **kluczem** (`COSIGN_PRIVATE_KEY`/`COSIGN_PASSWORD` z env, klucz przez `env://`, nigdy w argumentach) — oba po digeście `obraz@sha256:…`.
- Na tagu `v*`: zamiast build — re-tag `:<sha>` → `:<tag>` dla obu obrazów **bez zmiany digestu** (narzędzie do potwierdzenia w planie: `docker buildx imagetools create` albo `crane tag`; kryterium: digest `:<tag>` == digest `:<sha>`, sprawdzane w jobie). Brak `:<sha>` (commit spoza `main`) → błąd.
- Na innych gałęziach i PR: build bez push, jak dziś.

**`ci.yml` — nowe joby** (szkic):

```yaml
  deploy-dev:
    if: github.ref == 'refs/heads/main'
    needs: docker
    permissions: { contents: read, packages: read }
    uses: ./.github/workflows/deploy.yml
    with: { environment: dev }
    secrets: inherit

  deploy-staging:
    if: github.ref == 'refs/heads/main'
    needs: deploy-dev
    # … jak wyżej, environment: staging

  check-staging:               # promocja wymuszona: prod tylko po zielonym staging dla tego SHA
    if: startsWith(github.ref, 'refs/tags/v')
    needs: docker
    permissions: { deployments: read }
    runs-on: ubuntu-latest
    steps:
      - run: |   # najnowszy deployment staging dla SHA → najnowszy status == success, inaczej czytelny błąd
          gh api "repos/$GITHUB_REPOSITORY/deployments?environment=staging&sha=$GITHUB_SHA" …
        env: { GH_TOKEN: "${{ github.token }}" }

  deploy-production:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: check-staging
    # … jak deploy-dev, environment: production

  release:
    needs: deploy-production
    permissions: { contents: write }
    runs-on: ubuntu-latest
    steps:
      - run: gh release create "$GITHUB_REF_NAME" --generate-notes --verify-tag
        env: { GH_TOKEN: "${{ github.token }}", GH_REPO: "${{ github.repository }}" }
```

`check-staging` jest osobnym jobem przed `deploy-production`, żeby prośba o zatwierdzenie nie pojawiła się dla commita, którego nie wolno promować. Gdy tag wysłano razem z commitem na `main` (`git push --follow-tags`), staging jeszcze nie skończył → `check-staging` pada z komunikatem „staging dla <sha> nie jest zielony — poczekaj i uruchom ponownie".

**`deploy.yml`** (szkic):

```yaml
on:
  workflow_call:
    inputs:
      environment: { type: string, required: true }

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}   # tu: sekrety, zmienne, polityki i brama środowiska
    concurrency: { group: "deploy-${{ inputs.environment }}", cancel-in-progress: false }
    env:
      COMPOSE_PROJECT_NAME: teamable_${{ inputs.environment }}
      COMPOSE_FILE: docker-compose.deploy.yml
      FRONTEND_PORT: ${{ vars.FRONTEND_PORT }}
      BETTER_AUTH_URL: ${{ vars.BETTER_AUTH_URL }}
      SEED_ON_START: ${{ vars.SEED_ON_START }}
      DEMO_USER_EMAIL: ${{ vars.DEMO_USER_EMAIL }}
      BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}
      DEMO_USER_PASSWORD: ${{ secrets.DEMO_USER_PASSWORD }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3      # ghcr.io, GITHUB_TOKEN; obrazy są dziś publiczne, login chroni przed zmianą widoczności
      - uses: sigstore/cosign-installer@… # wersja przypięta w planie
      - name: Rozwiąż digesty i zweryfikuj podpisy
        run: |
          # SHA commita z checkoutu (odporne na tagi z adnotacją), właściciel małymi literami
          # dla backend i frontend: digest z :<sha7> → cosign verify --key cosign.pub
          #   oraz cosign verify --certificate-identity <ci.yml@refs/heads/main> --certificate-oidc-issuer https://token.actions.githubusercontent.com
          # → BACKEND_IMAGE / FRONTEND_IMAGE = obraz@sha256:… do $GITHUB_ENV, digesty do $GITHUB_STEP_SUMMARY
      - run: docker compose pull
      - run: docker compose up -d --wait
      - run: ./scripts/smoke-test.sh "$BETTER_AUTH_URL"
        env: { SMOKE_LOGIN: "${{ vars.SEED_ON_START }}" }
      - if: failure()
        run: docker compose logs
      - if: always()
        run: docker compose down -v
```

- **Promocja = ten sam commit i ten sam digest.** W jednym przebiegu wszystkie joby mają ten sam SHA; release (tag) wskazuje commit, którego obraz zbudował i podpisał wcześniej przebieg z `main`, a `check-staging` potwierdza, że staging go przyjął.
- **Weryfikuj to, co uruchamiasz:** digest rozwiązywany raz, podpisy sprawdzane dla digestu, compose uruchamia ten sam digest. Weryfikacja keyless sprawdza tożsamość workflow (repo + `ci.yml` + `refs/heads/main`), więc podpis z innego repo, gałęzi lub workflow nie przejdzie. Zmiana nazwy `ci.yml` wymaga zmiany tożsamości w `deploy.yml`.
- **Tag na commicie spoza `main`** nie ma obrazu `:<sha>` → re-tag w jobie `docker` pada → produkcja się nie wdraża.
- Na PR i gałęziach innych niż `main` joby `deploy-*` są pomijane (`if`), a branch policy dev/staging i tak by je odrzuciła.
- Uprawnienia: wywołujący `deploy-*` daje `contents: read, packages: read`; `docker` potrzebuje `packages: write` i `id-token: write`; `check-staging` — `deployments: read`; `release` — `contents: write`. Odpowiedź na niewiadomą ADR-0012: `packages: read` wystarcza do pobrania obrazu w wywoływanym workflow.
- Flagi cosign potwierdzone 2026-11-22 w dokumentacji v3.1.4 (`sigstore/cosign`: `doc/cosign_sign.md`, `doc/cosign_verify.md`) i w README `sigstore/cosign-installer` v4.1.3, którego oficjalny przykład podpisuje ten sam digest kluczem i keyless. cosign v3 domyślnie zapisuje podpisy jako artefakty OCI 1.1 (referrers); zachowanie GHCR do potwierdzenia w pierwszym przebiegu (awaryjnie `--registry-referrers-mode legacy`).

## 6. Smoke test

`scripts/smoke-test.sh <BASE_URL>` (bash, `set -euo pipefail`):

1. `GET /api/health` → 200 i `"status":"ok"` (backend + Mongo); `curl --retry` na start nginx.
2. `GET /` → zawiera `<div id="app">` (nginx serwuje SPA).
3. `GET /api/profile` bez ciasteczka → **401** (uwierzytelnianie włączone).
4. `POST /api/auth/sign-in/email` z `Origin: <BASE_URL>` i nieistniejącym kontem → **401**, nie 403 (origin `BETTER_AUTH_URL` zgadza się z adresem aplikacji). Działa bez konta, więc także na produkcji.
5. Tylko gdy `SMOKE_LOGIN=true` (dev/staging): logowanie kontem demo, ciasteczko do pliku tymczasowego → `GET /api/profile` z ciasteczkiem → 200 i `email` równy `DEMO_USER_EMAIL` małymi literami.

- Ciało logowania budowane przez `jq` i podawane przez stdin: hasło nie trafia do argumentów procesu ani do logów.
- Krok 4 sprawdza `BETTER_AUTH_URL` wszędzie; krok 5 dodatkowo seed przy starcie i `BETTER_AUTH_SECRET` (podpis sesji).
- Krok 4 to jedna nieudana próba logowania na wdrożenie — daleko od limitu prób [wniosek].
- Production wykonuje kroki 1–4.

## 7. Release flow

```bash
# main zielony, dev i staging wdrożone dla tego commita
git switch main && git pull
git tag v1.0.0 && git push origin v1.0.0
# → CI na tagu: testy → docker (re-tag :<sha> → :v1.0.0) → check-staging → zatwierdzenie → deploy-production → release
```

Tag mapuje wersję → SHA → digest; zero rebuildu. `gh release create --generate-notes` zbiera notatki z commitów (Conventional Commits) od poprzedniego tagu.

## 8. Testy

Unit / integracyjne / E2E bez zmian. Nowe: testy `SEED_ON_START` w `env.spec.ts` i smoke po wdrożeniu (weryfikuje środowisko, nie logikę). Weryfikacja etapu w działającym pipeline:

- zielony przebieg na `main` (podpisy → dev → staging), digesty w podsumowaniu;
- release `v*` z zatwierdzeniem i GitHub Release;
- kontrprzykłady (dowód, że bramy działają): tag na commicie z czerwonym albo niewdrożonym staging → `check-staging` czerwony; obraz bez podpisu kluczem (albo podpisany z innej gałęzi) → weryfikacja w `deploy.yml` czerwona. Linki do przebiegów w ADR-0012/0013.

## 9. Dokumentacja

- `requirements.md`: 2.3 (Etap 7), 2.4 (link do planu), 2.5 (backlog), 8.1 (decyzje 31–37 po rewizji, 56–58), status dokumentu.
- `README.md`: sekcja „Wdrożenia (Etap 5)" — jak działa pipeline, konfiguracja Environments i sekretów cosign (generowanie pary kluczy), release, ręczna weryfikacja podpisu obrazu.
- ADR-0012 i ADR-0013 → Zaakceptowany po wdrożeniu (SHA commitów, linki do przebiegów).

## 10. Definicja ukończenia

- [ ] `SEED_ON_START` w `env.ts` (z wymogiem `DEMO_*`) i w `index.ts`; testy w `env.spec.ts`.
- [ ] `docker-compose.deploy.yml` z obrazami po digeście, wymaganymi zmiennymi (`:?`), bez portu backendu.
- [ ] Trzy Environments: dev/staging z policy `main`, production z policy `v*` i required reviewers; sekrety repo `COSIGN_*`, `cosign.pub` w repo.
- [ ] Job `docker`: podpisy keyless + kluczem na `main`, re-tag bez zmiany digestu na tagu.
- [ ] `deploy.yml` (`workflow_call`, `concurrency`, weryfikacja podpisów, deploy po digeście, digest w podsumowaniu) + joby `deploy-dev` → `deploy-staging` (main) i `check-staging` → `deploy-production` → `release` (tag).
- [ ] `scripts/smoke-test.sh` z krokami 1–5; błąd czerwieni job, logi compose przy porażce, teardown zawsze.
- [ ] Zielony przebieg na `main`, release `v*` wdrożony po zatwierdzeniu, kontrprzykłady z sekcji 8 czerwone.
- [ ] `requirements.md`, `README.md`, ADR-0012, ADR-0013 zaktualizowane.

## 11. Zostawione wykonawcy

Dokładna składnia healthchecków i retry w smoke, nazwy kroków, narzędzie re-tagu (kryterium: ten sam digest), przypięte wersje `cosign-installer`, sposób rozwiązania digestu z etykiety, treść komunikatów błędów, kolejność commitów w planie, czy `check-staging` porównuje najnowszy deployment czy dowolny udany.
