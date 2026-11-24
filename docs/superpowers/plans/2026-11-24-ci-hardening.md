# Hardening CI przeciw kradzieży sekretów (łańcuch dostaw). Plan wdrożenia (stan po wdrożeniu)

> **For agentic workers:** plan opisuje stan po wdrożeniu (as-built); kroki są odhaczone, a wyniki weryfikacji wpisane pod nimi. Steps use checkbox (`- [ ]`) syntax for tracking.

**Lokalizacja w repo:** `docs/superpowers/plans/2026-11-24-ci-hardening.md`.

**Sposób wykonania:** Native, w jednej sesji, bez worktree. Plan dopisany po wdrożeniu, na prośbę użytkownika, jako zapis decyzji i dowodów.

**Goal:** Ograniczyć, co może ukraść albo zrobić kod wykonany w GitHub Actions (złośliwy workflow, podmieniona akcja, skrypt instalacyjny zależności), zanim Etap 5 doda do repo sekrety (cosign) i Environments.

**Architecture:** Bez nowych jobów i bez nowych narzędzi. Sześć zmian:
1. `permissions: {}` na poziomie workflow, a każdy job prosi o swoje uprawnienia.
2. Akcje przypięte do pełnego SHA z komentarzem wersji.
3. Dependabot dla `github-actions` (przypięte SHA się nie starzeją) i dla npm (`/`, `backend/`, `frontend/`, z karencją 7 dni i grupami dla przypiętych wersji).
4. `persist-credentials: false` w checkoutach.
5. `npm ci --ignore-scripts` w CI i w obu Dockerfile.
6. Test `backend/src/__tests__/pinnedDeps.spec.ts` pilnuje przypiętych wersji (`better-auth`, `mongodb`), które Dependabot podbija.

**Tech Stack:** GitHub Actions, Dependabot, npm 10+, Docker (multi-stage, `node:20-alpine`).

**Spec:** brak osobnego speca. Źródło: audyt bezpieczeństwa pod kątem kampanii wfx-loot / WFX Phantom (2026-11-24, `docs/prompts/security_scan.md`). Audyt nie wykazał kompromitacji. Wnioski, które dały ten plan:
- Brak ochrony `main`, a rulesetów brak (`gh api repos/…/rulesets` → `[]`).
- Akcje przypięte tagami, `allowed_actions: all`, `sha_pinning_required: false`.
- `npm ci` z lifecycle scripts po checkoucie, który zostawia token w `.git/config` (`actions/checkout@v4`).
- Dokumentacja GitHuba: „Any user with write access to your repository has read access to all secrets”. Workflow może podnieść uprawnienia `GITHUB_TOKEN` kluczem `permissions` mimo domyślnego „read”.

## Global Constraints

- **Gałąź:** `ci/harden-workflows` od `main`, PR #12.
- **Bez zmiany zachowania akcji:** SHA = obecne tagi wersji głównych (sprawdzone: `commits/vN` == `commits/vN.x.y`). Podbicia wersji głównych proponuje Dependabot w osobnych PR-ach.
- **Bez nowych zależności i akcji.** zizmor (statyczna analiza workflow) zostaje na później: osobna akcja w CI to kolejny element łańcucha dostaw.
- **Bez ADR-a:** zmiany łatwo odwrócić i widać je w kodzie, to krok procesu (reguły z `CLAUDE.md`). Reguły trafiają do `CLAUDE.md`, sekcja CI. ADR-0007 bez zmian: decyzja (jedna kopia `mongodb`, zakres jak w mongoose) obowiązuje, a test `pinnedDeps.spec.ts` tylko automatyzuje opisane w nim ręczne sprawdzanie `npm ls mongodb`.
- **Ustawienia repo poza zakresem PR-a** (ruleset, Dependabot alerts, lista akcji): to ręczne kroki właściciela, opisane w „Dalsze kroki”.

## Review Focus

1. **Czy coś wymaga skryptu instalacyjnego?** W drzewie są `esbuild`, `ssh2`, `cpu-features`, `protobufjs` (backend) oraz `fsevents` (frontend). → Task 1 (pełna bramka na czystej instalacji `--ignore-scripts`) i Task 4 (CI).
2. **Czy job traci potrzebne uprawnienie?** `upload-artifact` i cache `setup-node` używają tokenu runtime, nie `GITHUB_TOKEN`. `docker` zachowuje `packages: write`. → Task 4 (wszystkie joby zielone, w tym `docker`).
3. **Czy któryś krok używa poświadczeń git po checkoucie?** `docker/build-push-action` buduje z lokalnego katalogu (`context: ./backend`), nie z kontekstu git. → Task 4.
4. **SHA naprawdę odpowiadają wersjom z komentarzy.** → Task 2, Step 1.

---

### Task 1: Weryfikacja `--ignore-scripts` przed zmianą

**Files:** brak zmian w repo. Kopia `git archive HEAD` w scratchpadzie sesji, bez ruszania `node_modules` w repo.

- [x] **Step 1: Czysta instalacja bez skryptów**

Run (w kopii, osobno `backend/` i `frontend/`): `npm ci --ignore-scripts --no-audit --no-fund`
Wynik: 462 pakiety (backend) i 431 (frontend). `esbuild` 0.28.0 ładuje się bez postinstall (binarka z `optionalDependencies`). Frontend nie ma esbuild (Vite 8).

- [x] **Step 2: Bramka CI obu pakietów** (macOS, Node 24)

Run: `npm run lint`, `npx prettier --check src`, `npm run type-check`, testy z coverage, `npm run build`
Wynik: wszystko OK. Backend: 13 plików, **113/113** testów (Testcontainers działa bez natywnych `ssh2`/`cpu-features`).

- [x] **Step 3: Obrazy Docker z `--ignore-scripts`** (Linux arm64, Node 20)

Run: `docker build` obu obrazów z poprawionymi Dockerfile, potem `node -e 'import("express")…import("better-auth")'` w obrazie backendu.
Wynik: oba buildy OK, a zależności ładują się w runtime (`v20.20.2 linux arm64`). Testowe obrazy usunięte.

- [x] **Step 4: E2E**

Run: `npm run test:e2e` (z `backend/`), w kopii i w repo (normalna instalacja) dla porównania.
Wynik: 73/74 w obu przypadkach. `SEC-3` pada identycznie także na normalnej instalacji, więc nie ma związku ze zmianą (patrz „Odkrycia”).

---

### Task 2: Zmiany w workflow i Dockerfile

**Files:**
- Modify: `.github/workflows/ci.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `CLAUDE.md`
- Create: `.github/dependabot.yml`

- [x] **Step 1: Rozwiąż SHA dla wersji głównych w użyciu**

Run: dla każdej akcji najnowszy tag `vN.x.y` z `releases`, potem `gh api repos/<akcja>/commits/<tag> --jq .sha` i porównanie z `commits/vN`.

| Akcja | Wersja | SHA |
|---|---|---|
| `actions/checkout` | v4.4.0 | `11d5960a326750d5838078e36cf38b85af677262` |
| `actions/setup-node` | v4.4.0 | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
| `actions/upload-artifact` | v4.6.2 | `ea165f8d65b6e75b540449e92b4886f43607fa02` |
| `docker/login-action` | v3.7.0 | `c94ce9fb468520275223c153574b00df6fe4bcc9` |
| `docker/metadata-action` | v5.10.0 | `c299e40c65443455700f0fdfc63efafe5b349051` |
| `docker/build-push-action` | v6.19.2 | `10e90e3645eae34f1e60eeb005ba3a3d33f178e8` |

Wynik: każdy SHA == SHA tagu wersji głównej.

- [x] **Step 2: `ci.yml`**

- `permissions: {}` pod `on:`. `frontend`, `backend` i `e2e` dostają `permissions: contents: read`, `docker` bez zmian (`contents: read`, `packages: write`).
- `uses: <akcja>@<sha> # vX.Y.Z` we wszystkich krokach.
- `with: persist-credentials: false` w każdym `actions/checkout`.
- `run: npm ci --ignore-scripts` we wszystkich instalacjach.
- Komentarz w nagłówku wyjaśnia wszystkie cztery reguły.

Run: `ruby -ryaml -e '…'` (parsowanie i wypisanie `permissions` per job).
Wynik: YAML poprawny, `top={}`, `frontend/backend/e2e={contents: read}`, `docker={contents: read, packages: write}`.

- [x] **Step 3: Dockerfile**

`RUN npm ci --ignore-scripts` (builder obu obrazów) i `RUN npm ci --omit=dev --ignore-scripts` (runtime backendu).

- [x] **Step 4: `.github/dependabot.yml`**

`package-ecosystem: github-actions`, `directory: /`, `interval: weekly`, jedna grupa `actions` (`patterns: ['*']`), `commit-message.prefix: ci`. Składnię sprawdziłem w dokumentacji GitHuba przez Context7 (`/github/docs`, `dependabot-options-reference.md`, `customizing-dependabot-prs.md`).

- [x] **Step 4a: Dependabot dla npm** (dopisane na prośbę użytkownika, ten sam PR)

Wpis `package-ecosystem: npm` dla `directories: [/, /backend, /frontend]`:
- co tydzień, grupa `minor-patch` (`update-types: [minor, patch]`): jeden PR na katalog, a wersje major w osobnych PR-ach;
- `cooldown.default-days: 7`, czyli nowe wydanie czeka tydzień (ochrona przed świeżo przejętymi wersjami paczek);
- commity `chore(deps)` / `chore(deps-dev)` (`prefix: chore`, `include: scope`).

Przypięte wersje (pierwsza pasująca grupa wygrywa):
- `better-auth`: grupa z `group-by: dependency-name`, czyli jeden PR dla `backend/` i `frontend/` naraz.
- `mongo` (`mongoose`, `mongodb`): podbijane razem, bo zakres `mongodb` idzie za mongoose (ADR-0007). Gdy `mongodb` wyprzedza mongoose, test każe poczekać.
- Pierwsza wersja wyłączała obie paczki przez `ignore`. Użytkownik zapytał o automatyzację, więc `ignore` zastąpiły grupy i test `pinnedDeps.spec.ts` (Step 4b).

Run: walidacja `ajv` względem schematu SchemaStore `dependabot-2.0.json` (YAML → JSON przez `ruby`).
Wynik: `SCHEMA VALID`. Połączenia grupy z `group-by` z innymi grupami dokumentacja nie pokazuje wprost. Opisuje tylko `group-by` jako parametr pojedynczej grupy i kolejność dopasowania. [do potwierdzenia po merge'u: Insights → Dependency graph → Dependabot]

- [x] **Step 4b: Test spójności przypiętych wersji**

Create: `backend/src/__tests__/pinnedDeps.spec.ts`. Czyta `package.json` i `package-lock.json` (bez uruchamiania npm):
- `better-auth`: w każdym pakiecie deklaracja w `package.json` jest równa wersji z lockfile, co wymusza dokładne przypięcie (zakres `^1.7.27` nie przejdzie), i obie deklaracje są takie same. Pierwsza wersja testu porównywała tylko deklaracje między sobą i lockfile'y między sobą, więc przepuszczała `^1.7.27` w obu pakietach. Wykrył to review Copilota w PR #12 i dodaliśmy porównanie z lockfile;
- w lockfile backendu jest dokładnie jedna kopia `mongodb`. Komunikat błędu podaje zakres wymagany przez mongoose.

Kod backendu nie importuje `mongodb` bezpośrednio, więc duplikat nie musi wyjść w `type-check`. Test łapie go na poziomie lockfile.

Run: `npx vitest run src/__tests__/pinnedDeps.spec.ts`. Najpierw na obecnym stanie, potem z tymczasowo zepsutym stanem (cofanym przez `git checkout`).
Wynik: GREEN 2/2. RED 1 (frontend `better-auth` 1.7.26): „zaktualizuj better-auth w obu package.json do tej samej wersji”. RED 2 (zagnieżdżone `mongoose/node_modules/mongodb@7.3.0`): „mongoose wymaga mongodb ~7.3: ustaw ten zakres w backend/package.json…”. Lint, prettier i `type-check` OK.

- [x] **Step 5: `CLAUDE.md`**

W sekcji „Sposób pracy → CI” jedno zdanie z regułami i obejściem dla zależności, która wymaga skryptu instalacyjnego (`npm rebuild <pakiet>`).

- [x] **Step 6: Commit**

`e55af0c ci: harden workflow against supply-chain secret theft`. Pre-commit przebudował `graphify-out/graph.json`.

---

### Task 3: Plan w repo

- [x] **Step 1: Ten plik** (`docs(plan): …`), dopisany do PR #12.

---

### Task 4: Weryfikacja w CI

- [x] **Step 1: PR #12, oba przebiegi (push i pull_request)**

Run: `gh pr checks 12 --watch`
Wynik dla `e55af0c` (workflow i Dockerfile): `frontend`, `backend`, `e2e` i `docker` zielone w obu przebiegach. E2E na `ubuntu-24.04`: **74 passed (1.1m)**. W logach: `persist-credentials: false`, `npm ci --ignore-scripts`, a w buildzie Dockera `RUN npm ci --omit=dev --ignore-scripts`.

Wynik dla `1a307bb` (Dependabot npm + `pinnedDeps.spec.ts`): wszystkie joby zielone w obu przebiegach. W jobie `backend`: `✓ src/__tests__/pinnedDeps.spec.ts (2 tests)`. E2E: **74 passed (1.0m)**.

---

## Odkrycia

- **`SEC-3` pada lokalnie na macOS, w CI przechodzi.** Test `e2e/security.spec.ts:56` timeoutuje na `page.evaluate(fetch(...))` z obcej strony do localhost, także na normalnej instalacji. W CI przechodzi (run #53 i PR #12: 74 passed). Prawdopodobna przyczyna to monit Chromium o dostęp do sieci lokalnej [wniosek, niezweryfikowany]. Do osobnego zgłoszenia.
- **Ostrzeżenie „Node.js 20 is deprecated”** dla akcji v4 (`checkout`, `setup-node`, `upload-artifact`). GitHub wymusza na nich Node 24. Akcje działają, a podbicie wersji głównych zaproponuje Dependabot.
- **Hook graphify buduje graf z drzewa roboczego,** więc do `graph.json` trafił też nieśledzony `docs/prompts/security_scan.md`. To znane ograniczenie (`shortcut:` w `.husky/graphify-update.sh`).
- **Push rulesets (ochrona ścieżek, np. `.github/workflows/**`) są niedostępne dla tego repo.** Dokumentacja GitHuba: tylko repozytoria „private or internal”.

## Dalsze kroki (poza tym PR-em)

- [ ] **Ustawienia repo (właściciel):**
  - ruleset na `main` (wymagany PR, wymagane checki z aplikacji GitHub Actions, blokada force-push i usuwania);
  - Dependabot alerts;
  - „Allow select actions” z wymogiem pełnego SHA, włączone **po** merge'u tego PR-a, inaczej CI na `main` padnie.
- [ ] **Spec Etapu 5 / ADR-0013:** `COSIGN_*` przenieść z sekretów repo do Environment z branch policy (osobny job `sign` na `main`) albo zostawić tylko podpis keyless. Weryfikacja keyless już przypina tożsamość `ci.yml@refs/heads/main`.
- [ ] **Backlog `requirements.md` 2.5 na gałęzi Etapu 5:** wiersz „Przypinanie akcji GitHub po SHA + Dependabot” oznaczyć jako zrealizowany.
- [ ] **Opcjonalnie:** zizmor jako job w CI (akcja przypięta do SHA).
- [ ] **Konto właściciela:**
  - token `gh` z zakresem `repo` na wszystkie repozytoria → rozważyć fine-grained PAT;
  - passkey;
  - przegląd sesji, OAuth Apps i kluczy.
