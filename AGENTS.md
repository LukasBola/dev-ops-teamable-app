# Teamable — wskazówki dla Codex

Projekt edukacyjny do nauki DevOps: profil członka zespołu (Vue 3 + Express 5 + MongoDB), rozwijany etapami. Aplikacja jest poligonem — nacisk na proces (CI/CD, kontenery, sekrety, testy), nie na liczbę funkcji. **Dokumentację, komunikaty, komentarze w kodzie i opisy testów piszemy po polsku**; commity po angielsku (Conventional Commits).

## Źródła prawdy

| Co | Gdzie |
|---|---|
| Wymagania, plan etapów, tabela decyzji (8.1) | `requirements.md` |
| Projekty techniczne etapów (spec) | `docs/superpowers/specs/YYYY-MM-DD-<temat>-design.md` |
| Plany implementacji | `docs/superpowers/plans/YYYY-MM-DD-<temat>.md` |
| Decyzje architektoniczne | `docs/adr/` (od Etapu 4.5) |
| Projekt UI (tokeny DTCG, makieta, zrzuty) | `docs/design/` |
| Uruchomienie i konta krok po kroku | `README.md` |
| Graf wiedzy o kodzie i dokumentach | `graphify-out/` (patrz niżej) |

**Stan:** Etapy 1–4.5 wdrożone (frontend, backend, MongoDB, Docker, uwierzytelnianie). Następne: Etap 5 (CD) i Etap 6 (obserwowalność i jakość) — specy i plany z 2026-06-17 wymagają przeglądu względem obecnego kodu przed wdrożeniem.

## Stos

- **Frontend** (`frontend/`): Vue 3 + TypeScript, Vite, Tailwind CSS 4 (tokeny w `@theme`), Better Auth client. Testy: Vitest + Vue Test Utils, E2E Playwright. Lint: oxlint + ESLint, Prettier.
- **Backend** (`backend/`): Node 20 (ESM), Express 5, TypeScript, Better Auth, Mongoose + `mongodb`, multer (avatar), Zod (env i wejście API), migrate-mongo. Testy: Vitest + Testcontainers (MongoDB).
- **Infrastruktura:** Docker multi-stage (backend: `node:20-alpine`, frontend: nginx), `docker-compose.yml` w korzeniu (pełny stack, :8080), `backend/docker-compose.yml` (sama Mongo do dev), GitHub Actions (`.github/workflows/ci.yml`), obrazy w GHCR (tag SHA + `latest` z `main`).
- **Narzędzia repo:** Husky + lint-staged + commitlint, Makefile, Graphify.

## Struktura

```text
backend/src/
  app.ts, index.ts, env.ts   # składanie aplikacji, start, walidacja env (Zod)
  auth/      # Better Auth, konta (users.ts), konto demo (demoUser.ts)
  cli/       # CLI kont: create | delete | set-password
  db/        # połączenie z MongoDB
  middleware/ # errorHandler, originCheck (CSRF), requireAuth
  models/ schemas/ types/    # Mongoose, Zod, typy kontraktu Profile
  routes/    # /api/profile
  services/  # trwałość profilu (profileStore), przejęcie profilu sprzed kont
  __tests__/ # unit + integracja (Testcontainers), test warstw
backend/migrations/  backend/scripts/   # migracje, migrate.cjs, seed, orkiestrator E2E
frontend/src/  components/ composables/ services/ types/ utils/
frontend/e2e/  # Playwright (projekt setup + storageState)
```

## Komendy

Wszystko z korzenia repo przez `make` (`make help` wypisuje listę). Wymaga Node 20.6+ i Dockera.

| Cel | Komenda |
|---|---|
| Zależności | `make install` |
| `.env` z wygenerowanym `BETTER_AUTH_SECRET` | `make env` (istniejących plików nie rusza) |
| Dev: Mongo + migracje + backend :3001 + frontend :5173 | `make dev` |
| Migracje / konto demo | `make migrate` / `make seed` |
| Konta | `make user ARGS="create --email a@x.pl --password '…'"` |
| Testy unit + integracyjne (backend potrzebuje Dockera) | `make test` |
| E2E (kontener Mongo + migracje + Playwright) | `make e2e` |
| Pełny stack jak na prod (:8080) | `docker compose up --build` |
| Lint / typy (per pakiet) | `npm run lint`, `npm run type-check` w `frontend/` lub `backend/` |
| Coverage | `npm run test:coverage` (backend), `npm run test:unit:coverage` (frontend) |

Przed zgłoszeniem pracy jako gotowej uruchom to, co robi CI dla zmienionego pakietu: lint, `prettier --check src`, type-check, testy, build; przy zmianach w API, auth lub UI także `make e2e`.

## Niezmienniki architektury

Złamanie któregoś psuje coś po cichu. Szczegóły i uzasadnienie w podlinkowanych ADR-ach.

- **Jeden origin SPA + API, bez CORS** — proxy Vite w dev, nginx w Dockerze; frontend nie ma zmiennych środowiskowych ([ADR-0002](docs/adr/0002-jeden-origin-spa-api.md)). `BETTER_AUTH_URL` = adres widziany przez przeglądarkę (dev :5173, compose :8080); inny origin → 403.
- **Kolejność middleware w `backend/src/app.ts`:** handler `/api/auth/*` przed `express.json()` (Better Auth sam czyta body) → `originCheck` na `/api` ([ADR-0003](docs/adr/0003-ochrona-csrf-origin.md)) → `requireAuth` przed `profileRouter` (bez sesji multer nic nie zapisuje) → `errorHandler` na końcu.
- **Warstwy backendu:** `services/` nie importuje z `middleware/` ani z `auth/` — pilnuje tego `__tests__/layers.spec.ts`. Błędy HTTP (`HttpError`) zostają w warstwie tras/middleware.
- **Profil per użytkownik:** dokument `profiles` z `_id = userId`, avatar w `uploads/<userId>/`; kontrakt `Profile` w API bez `_id` ([ADR-0005](docs/adr/0005-profil-per-uzytkownik.md)). Rejestracja zamknięta — konta tylko przez CLI/seed ([ADR-0001](docs/adr/0001-better-auth.md)).
- **Env walidowany przy starcie** (`backend/src/env.ts`, Zod) — brak zmiennej = backend nie wstaje ([ADR-0004](docs/adr/0004-walidacja-env-zod.md)). Nowa zmienna: schemat + `backend/.env.example` (+ `.env.example` i compose, jeśli dotyczy Dockera).
- **Przypięte wersje:** `better-auth` dokładnie tą samą wersją we frontendzie i backendzie; `mongodb` w wersji zgodnej z mongoose ([ADR-0007](docs/adr/0007-jeden-sterownik-mongodb.md)). Dependabot podbija `better-auth` jednym PR-em w obu pakietach, a `mongodb` tylko w wersjach patch razem z `mongoose` (minor/major ustawiamy ręcznie na zakres z mongoose, gdy test tego zażąda), a `backend/src/__tests__/pinnedDeps.spec.ts` wywraca CI, gdy wersje się rozjadą.
- **Indeksy kolekcji auth tworzy migracja**, nie aplikacja ([ADR-0006](docs/adr/0006-indeksy-auth-w-migracji.md)); kontener backendu uruchamia `migrate up` przed startem (`docker-entrypoint.sh`).
- **W Dockerze tylko frontend publikuje port.** Limit prób logowania liczy po `X-Real-IP` ustawianym przez nginx — otwarty port backendu pozwoliłby go obejść.
- **UI:** tokeny w `@theme`, fonty lokalnie z `@fontsource` ([ADR-0008](docs/adr/0008-ui-identyfikator-tokeny-fonty.md)); zmiany wyglądu zgodne z `docs/design/`.

## Testy

- **Backend:** Vitest z prawdziwą MongoDB z Testcontainers (bez mocków bazy); testy migracji, CLI, seeda i warstw.
- **Frontend:** Vitest + Vue Test Utils (komponenty, composable, serwisy).
- **E2E:** `backend/scripts/e2e-mongo.ts` podnosi Mongo, migruje i uruchamia Playwrighta (backend :3101, tymczasowy `PROFILE_DATA_DIR`). Sesje przez projekt `setup` i `storageState`, sekrety generowane na przebieg ([ADR-0009](docs/adr/0009-e2e-auth-storagestate-sekrety-per-przebieg.md)). Każde FR z Etapu 4.5 ma test pozytywny i negatywny z ID w nazwie.
- Nowa logika = test. Błąd = najpierw test, który go odtwarza.

## Sposób pracy

- **Git:** GitHub Flow — krótka gałąź od `main` (`git switch -c feat/...`), PR do `main`. Bez worktree, chyba że użytkownik o niego poprosi. Commituj i pushuj tylko na prośbę.
- **Commity:** Conventional Commits (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`), wymuszane przez commitlint. Pre-commit uruchamia lint-staged i aktualizację grafu.
- **Etap = spec → plan → wdrożenie.** Nowy etap zaczyna się od specu (brainstorming) i planu w `docs/superpowers/`; po wdrożeniu zaktualizuj `requirements.md` (2.4 linki, 8.1 decyzje, status dokumentu) i README, jeśli zmienia się uruchomienie.
- **CI** (`ci.yml`): frontend i backend (lint, format, typy, testy z coverage, build) → e2e → obrazy Docker (push do GHCR tylko z `main`). Job e2e jest przypięty do `ubuntu-24.04` (Playwright nie obsługuje Chromium na 26.04) — zdejmij po podbiciu Playwrighta. Hardening: `permissions: {}` na poziomie workflow (job prosi o swoje), akcje przypięte do pełnego SHA z komentarzem wersji (podbija Dependabot, `.github/dependabot.yml`; tam też npm dla `/`, `backend/`, `frontend/`: co tydzień PR minor+patch na katalog, major osobno, 7 dni karencji), `persist-credentials: false`, `npm ci --ignore-scripts` w CI i Dockerfile — nowa zależność wymagająca skryptu instalacyjnego musi to obejść jawnie (np. `npm rebuild <pakiet>`).
- **Skróty z ograniczeniem** oznaczamy komentarzem `shortcut: <ograniczenie>, <kiedy poprawić>`.

## Decyzje architektoniczne (ADR)

Zapisuj decyzję jako ADR, gdy jest **istotna i cenna** — spełnia co najmniej jeden warunek z `docs/adr/README.md` („Kiedy pisać ADR”):

- trudno ją odwrócić albo dotyka wielu miejsc (baza, auth, granica frontend/API, format danych, kontrakt);
- wybieramy między realnymi opcjami, a powód nie wynika z samego kodu;
- wprowadza ograniczenie, którego złamanie psuje coś po cichu (przypięta wersja, kolejność middleware, nazwy indeksów);
- zmienia albo zastępuje wcześniejszą decyzję.

Nie pisz ADR-a dla łatwo odwracalnego wyboru biblioteki, szczegółów widocznych w kodzie, poprawek błędów ani kroków procesu — to trafia do planu, opisu PR albo komentarza w kodzie.

Kiedy:

- **Spec / plan / brainstorming:** decyzja spełniająca warunki → ADR ze statusem **Proponowany** razem ze specem; spec linkuje ADR.
- **W trakcie wdrożenia:** gdy trzeba zdecydować inaczej niż w specu albo pojawia się nowe ograniczenie (np. konflikt wersji, zachowanie biblioteki odkryte w testach) → nowy ADR albo rozstrzygnięcie niewiadomej w istniejącym. Powiedz użytkownikowi jednym zdaniem, że decyzja trafi do ADR-a.
- **Koniec etapu:** ADR-y etapu → **Zaakceptowany**, w „Dowodach” SHA commitów; niewiadome rozstrzygnięte z datą.

Jak:

- Kopia `docs/adr/0000-template.md` (wzór z projektu helpdesk), kolejny numer, nazwa `NNNN-krotki-tytul-kebab-case.md`, maks. ~1 strona.
- Każde twierdzenie ma dowód (commit, plik, wynik polecenia) albo dopisek `[wniosek]`. Nie dopisuj opcji, których nikt nie rozważał.
- Zaakceptowanego ADR-a nie zmieniaj merytorycznie: zmiana decyzji = nowy ADR, stary dostaje „Zastąpiony przez”.
- Dopisz wiersz do tabeli w `docs/adr/README.md` i do `requirements.md` 8.1 (kolejny wolny numer decyzji — sprawdź też specy etapów, bo numery bywają zarezerwowane).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
