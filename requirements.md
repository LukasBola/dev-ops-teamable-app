# Teamable — Wymagania projektu

> **Status dokumentu:** v0.5 (Etapy 5 — Wdrożenia/CD — i 6 — Obserwowalność/jakość — specy i plany gotowe, żywy dokument)
> **Ostatnia aktualizacja:** 2026-06-17
> **Charakter projektu:** projekt edukacyjny — aplikacja jest **poligonem do nauki DevOps**, nie celem samym w sobie.

---

## 1. Cel projektu

Głównym celem projektu jest **nauka DevOps** w praktyce na realnym, stopniowo rozbudowywanym przykładzie:

- pełny cykl SDLC (od commita do wdrożenia),
- CI/CD (automatyzacja buildów, testów, deployów),
- wdrożenia na wiele środowisk (np. dev / staging / production),
- testy na różnych poziomach piramidy testów: **jednostkowe**, **integracyjne**, **UI/E2E (Playwright)**.

Aplikacja (profil użytkownika) jest **pretekstem** — ma być na tyle prosta, by nie odwracać uwagi od DevOps, ale na tyle realistyczna, by dało się na niej ćwiczyć cały SDLC. Decyzje produktowe podejmujemy zawsze pod kątem: *czy to pomaga uczyć się DevOps?*

### 1.1 Zasady przewodnie (guiding principles)

- **Prostota aplikacji, dojrzałość procesu.** Kod aplikacji minimalny; pipeline, testy i automatyzacja — porządne.
- **Rozszerzalność.** Każdy etap będzie rozbudowywany. Struktura repozytorium, kodu i pipeline'u ma to ułatwiać, nie blokować.
- **Testowalność od początku.** Komponenty i moduły piszemy tak, by łatwo było je testować (jasne granice, brak ukrytych zależności).
- **Brak overengineeringu.** Nie wprowadzamy Kubernetes, mikroserwisów ani złożonej infrastruktury, dopóki nie pojawi się konkretny powód edukacyjny.

---

## 2. Zakres (Scope)

### 2.1 W zakresie obecnego etapu (Etap 1 — Frontend)

- Jedna strona / jeden widok: **profil użytkownika**.
- Statyczne dane profilu (na sztywno w kodzie lub w lokalnym pliku/`localStorage`), bez backendu.
- Podstawowa interaktywność (edycja profilu, wczytanie zdjęcia z dysku — lokalnie, bez wysyłki na serwer).
- Komplet narzędzi DevOps wokół frontendu (patrz sekcja 6 i 7).

### 2.2 Poza zakresem obecnego etapu (świadomie odłożone)

- Backend (Express) — **nie implementujemy teraz**, ale projektujemy frontend tak, by integracja była łatwa (patrz 5.3).
- Baza danych (MongoDB) — planowana, nieimplementowana.
- Uwierzytelnianie / autoryzacja, wielu użytkowników.
- Realne przechowywanie i hosting zdjęć (CDN/storage).

### 2.3 Plan rozwoju (kolejne etapy — orientacyjnie)

| Etap | Zakres | Główny nacisk DevOps |
|------|--------|----------------------|
| 1 | Frontend (ten dokument) | Build, lint, testy jednostkowe + E2E, pierwszy pipeline CI |
| 2 | Backend Express + API profilu | Testy integracyjne, kontrakt API, build wielu artefaktów |
| 3 | Integracja z MongoDB | Migracje, testy z bazą (np. kontenery testowe), seedy danych |
| 4 | Konteneryzacja (Docker) | Obrazy, docker-compose, środowiska lokalne = prod-like |
| 5 | Wdrożenia na środowiska (dev/staging/prod) | CD, promocja artefaktów, sekrety, zmienne środowiskowe |
| 6 | Obserwowalność i jakość | Logi, metryki, coverage gates, ewentualnie analiza statyczna |

> Tabela jest orientacyjna i będzie aktualizowana. Kolejność etapów może się zmienić.

### 2.4 Specyfikacje i plany implementacji (linki)

Szczegółowe projekty techniczne i plany powstają per etap w `docs/superpowers/`:

| Etap | Spec (projekt techniczny) | Plan implementacji |
|------|---------------------------|--------------------|
| 1 — Frontend | [2026-06-04-etap1-frontend-profilu-design.md](docs/superpowers/specs/2026-06-04-etap1-frontend-profilu-design.md) | [2026-06-04-etap1-frontend-profilu.md](docs/superpowers/plans/2026-06-04-etap1-frontend-profilu.md) |
| 2 — Backend + API | [2026-06-10-etap2-backend-design.md](docs/superpowers/specs/2026-06-10-etap2-backend-design.md) | [2026-06-10-etap2-backend.md](docs/superpowers/plans/2026-06-10-etap2-backend.md) |
| 3 — MongoDB | [2026-06-11-etap3-mongodb-design.md](docs/superpowers/specs/2026-06-11-etap3-mongodb-design.md) | [2026-06-11-etap3-mongodb.md](docs/superpowers/plans/2026-06-11-etap3-mongodb.md) |
| 4 — Docker | [2026-06-11-etap4-docker-design.md](docs/superpowers/specs/2026-06-11-etap4-docker-design.md) | [2026-06-11-etap4-docker.md](docs/superpowers/plans/2026-06-11-etap4-docker.md) |
| 5 — Wdrożenia (CD) | [2026-06-17-etap5-wdrozenia-design.md](docs/superpowers/specs/2026-06-17-etap5-wdrozenia-design.md) | [2026-06-17-etap5-wdrozenia.md](docs/superpowers/plans/2026-06-17-etap5-wdrozenia.md) |
| 6 — Obserwowalność i jakość | [2026-06-17-etap6-obserwowalnosc-jakosc-design.md](docs/superpowers/specs/2026-06-17-etap6-obserwowalnosc-jakosc-design.md) | [2026-06-17-etap6-obserwowalnosc-jakosc.md](docs/superpowers/plans/2026-06-17-etap6-obserwowalnosc-jakosc.md) |

---

## 3. Persona i kontekst użytkownika (lekko)

Aplikacja jest jednoosobowa i demonstracyjna. Nie ma realnych użytkowników końcowych. Mimo to projektujemy ekran tak, jakby był prawdziwym profilem — żeby testy E2E miały sensowne scenariusze.

---

## 4. Wymagania funkcjonalne (Etap 1)

Identyfikatory (FR-x) ułatwią późniejsze powiązanie wymagań z testami.

| ID | Wymaganie | Kryterium akceptacji (skrót) |
|----|-----------|------------------------------|
| FR-1 | Widok profilu wyświetla: zdjęcie, imię, nazwisko, email, opis ("About me"). | Wszystkie pola widoczne przy danych domyślnych. |
| FR-2 | Widok zawiera przycisk **„Edytuj profil”**. | Przycisk widoczny i klikalny. |
| FR-3 | Kliknięcie „Edytuj profil” przełącza widok w tryb edycji (pola edytowalne). | Pola tekstowe stają się edytowalne; pojawia się akcja zapisu/anulowania. |
| FR-4 | Użytkownik może edytować imię, nazwisko, email i opis, a następnie zapisać zmiany. | Po zapisaniu widok pokazuje nowe wartości. |
| FR-5 | Użytkownik może wczytać zdjęcie z dysku lokalnego. | Po wybraniu pliku graficznego podgląd aktualizuje się natychmiast (lokalnie, bez backendu). |
| FR-6 | Walidacja pola email (poprawny format). | Niepoprawny email blokuje zapis i pokazuje komunikat. |
| FR-7 | Trwałość danych między odświeżeniami strony przez `localStorage`. | Po odświeżeniu strony zmiany są zachowane. |

> FR-6 i FR-7 to dobre, „testowalne” wymagania — dają konkretne scenariusze dla testów jednostkowych i E2E. FR-7 (`localStorage`) jest w zakresie Etapu 1 zgodnie z decyzją (sekcja 8.1).

### 4.1 Wymagania funkcjonalne (Etap 2 — Backend + API)

Szczegóły projektowe: [spec Etapu 2](docs/superpowers/specs/2026-06-10-etap2-backend-design.md).

| ID | Wymaganie | Kryterium akceptacji (skrót) |
|----|-----------|------------------------------|
| FR-8 | Trwałość profilu przez backend w pliku JSON na dysku; po ponownym otwarciu aplikacji wczytuje się ostatnio zapisany profil. | Po zapisie i restarcie aplikacji/serwera widać ostatnie dane (zastępuje `localStorage` z FR-7 jako mechanizm trwałości). |
| FR-9 | Przy pierwszym uruchomieniu (brak zapisanych danych) profil ma puste wartości — bez danych i bez zdjęcia. | Czysty stan → puste pola, brak zdjęcia (zmienia domyślny seed z FR-1). |
| FR-10 | Zdjęcie profilowe jest wysyłane na backend i zapisywane jako plik; po zapisaniu serwowane z backendu. | Po zapisie profilu zdjęcie utrwalone i widoczne po reloadzie (rozszerza FR-5 o trwałość serwerową). |
| FR-11 | Edycja profilu z przyciskami **Zapisz** / **Anuluj**; „Anuluj" odrzuca niezapisane zmiany, w tym wybrane, niewysłane zdjęcie. | Po „Anuluj" backend i widok bez zmian; brak osieroconego pliku na serwerze. |
| FR-12 | Walidacja email również po stronie serwera. | `PUT` z niepoprawnym email zwraca błąd i nie zapisuje (rozszerza FR-6). |
| FR-13 | Możliwość usunięcia profilu (reset do stanu pustego). | `DELETE` czyści dane i zdjęcie → stan „pierwsze uruchomienie". |

> **Etap 3:** mechanizm trwałości z FR-8 (plik JSON) zostaje zastąpiony przez **MongoDB**; kryteria akceptacji FR-8…FR-13 pozostają w mocy (zmienia się tylko backend trwałości). Szczegóły: [spec Etapu 3](docs/superpowers/specs/2026-06-11-etap3-mongodb-design.md).

---

## 5. Wymagania niefunkcjonalne i architektura frontendu

### 5.1 Stos technologiczny (Etap 1)

| Warstwa | Wybór | Uzasadnienie |
|---------|-------|--------------|
| Framework UI | **Vue 3** (Composition API, `<script setup lang="ts">`) | Zgodnie z preferencją. Nowoczesny standard Vue. |
| Język | **TypeScript** | Decyzja v0.2. Typowanie ułatwia testowanie i utrwala kontrakt danych — wartościowe przy nauce SDLC. |
| Build / dev server | **Vite** | De facto standard dla Vue 3; szybki build i HMR; natywne wsparcie TS; wygodny w CI. |
| Style | **Tailwind CSS** | Szybki, spójny styling utility-first; mało własnego CSS do utrzymania. |
| Testy jednostkowe/komponentów | **Vitest** + **Vue Test Utils** | Natywne dla ekosystemu Vite/Vue, wsparcie TS, szybkie, prosty CI. |
| Testy E2E / UI | **Playwright** | Zgodnie z wymaganiem; świetne wsparcie CI i raportowanie. |
| Lint / format | **ESLint** + **Prettier** | Spójność kodu, brama jakości w CI; wymuszane pre-commit przez Husky + lint-staged. |
| Git hooks | **Husky** + **lint-staged** + **commitlint** | Conventional Commits i kontrola jakości jeszcze przed pushem. |
| Menedżer pakietów | **npm** | Decyzja v0.2. |

### 5.2 Styl i UX

- Design **nowoczesny, ale stonowany** — czysty layout, czytelna typografia, umiar w kolorach i animacjach.
- Responsywność: poprawne wyświetlanie na desktopie i mobile (mobile-friendly, niekoniecznie pełen mobile-first).
- Podstawowa dostępność (a11y): etykiety pól, kontrast, obsługa klawiatury dla akcji edycji.
- Styling: **Tailwind CSS** (utility-first), minimum własnego CSS.

### 5.3 Gotowość na backend (bez implementacji teraz)

Frontend projektujemy tak, by przyszła integracja z **Express + MongoDB** była łatwa:

- **Warstwa dostępu do danych odizolowana** w jednym module (np. `services/profileService.ts`) z funkcjami typu `getProfile()` / `updateProfile()`. Na Etapie 1 czytają/zapisują `localStorage`; na Etapie 2 zostaną podmienione na wywołania HTTP — bez zmian w komponentach.
- **Konfiguracja przez zmienne środowiskowe** (np. `VITE_API_BASE_URL`), nawet jeśli teraz nieużywana — przyzwyczaja do wzorca „config zależny od środowiska”, kluczowego w DevOps.
- **Stabilny kształt modelu danych** profilu (patrz 5.4), żeby kontrakt z backendem był przewidywalny.

### 5.4 Model danych profilu (kontrakt roboczy)

```ts
interface Profile {
  firstName: string;
  lastName: string;
  email: string;        // walidowany format e-mail (FR-6 front, FR-12 serwer)
  aboutMe: string;
  avatarUrl: string;    // Etap 1: data URL / lokalny blob → Etap 2: ścieżka/URL pliku na backendzie
}
```

> Ten interfejs będzie podstawą przyszłego API i schematu w MongoDB. Zmiany kontraktu odnotowujemy w tym dokumencie.
>
> **Zmiana kontraktu (Etap 2):** semantyka `avatarUrl` zmienia się z base64 data URL (Etap 1) na **ścieżkę/URL pliku serwowanego przez backend** (np. `/api/profile/avatar`); pusty string = brak zdjęcia. Kształt interfejsu bez zmian.
>
> **Trwałość (Etap 3):** źródłem prawdy profilu jest teraz **dokument MongoDB** (kolekcja `profiles`, singleton `_id:'profile'`). Kształt `Profile` i semantyka `avatarUrl` bez zmian; zdjęcie nadal plikiem na dysku, w dokumencie trzymany jest tylko `avatarUrl`. Mechanizm trwałości FR-8 (plik JSON) zostaje **zastąpiony przez MongoDB** — analogicznie do tego, jak FR-8 zastąpił `localStorage` z FR-7.

---

## 6. Wymagania jakościowe i strategia testów

Testy są **pierwszorzędnym celem projektu**, nie dodatkiem. Stosujemy piramidę testów.

| Poziom | Narzędzie | Co testujemy (Etap 1) |
|--------|-----------|------------------------|
| Jednostkowe / komponentowe | Vitest + Vue Test Utils | Logika walidacji (FR-6), renderowanie pól (FR-1), przełączanie trybu edycji (FR-3), zapis zmian (FR-4). |
| Integracyjne | Vitest (Etap 1) → realny backend/baza (Etap 2-3) | Na Etapie 1: interakcja komponentu z warstwą `profileService`. Później: realne wywołania API i baza. |
| UI / E2E | Playwright | Pełne ścieżki użytkownika: wyświetlenie profilu, edycja i zapis, wczytanie zdjęcia (FR-5), walidacja email. |

**Zasady:**

- Każde wymaganie funkcjonalne (FR-x) powinno mieć przypisany przynajmniej jeden test.
- Testy uruchamiane lokalnie **i** w CI tym samym poleceniem (np. `npm test`, `npm run test:e2e`).
- Pokrycie kodu (coverage) mierzone od początku; próg (gate) wprowadzimy stopniowo, by nie blokować nauki na starcie.

> **Etap 6:** wprowadzono twardy próg pokrycia (70% lines/functions/branches/statements) jako bramę CI dla frontend i backend; spadek poniżej progu czerwieni pipeline. Dochodzą też dwie analizy statyczne: **CodeQL** (bezpieczeństwo) i **SonarCloud** (utrzymywalność). Szczegóły: [spec Etapu 6](docs/superpowers/specs/2026-06-17-etap6-obserwowalnosc-jakosc-design.md).

---

## 7. Wymagania DevOps / SDLC (rdzeń projektu)

To jest najważniejsza sekcja merytoryczna projektu — będzie rozbudowywana najbardziej.

### 7.1 Repozytorium i workflow

- Git, jedno repozytorium (monorepo gotowe na dodanie `backend/` obok `frontend/`).
- Strategia gałęzi: **GitHub Flow** (rekomendacja, patrz 8.2) — krótkie gałęzie + PR do `main`.
- **Conventional Commits**, wymuszane przez **commitlint** w hooku `commit-msg` (Husky). Ułatwi późniejszą automatyzację wersjonowania/changelogu.
- **Pre-commit (Husky + lint-staged):** ESLint + Prettier na plikach w commicie, by błędy łapać przed CI.

### 7.2 CI (Continuous Integration) — cel Etapu 1

Pipeline uruchamiany na każdy push / pull request, kroki:

1. Instalacja zależności (z cache).
2. Lint (ESLint) + format check (Prettier).
3. Sprawdzenie typów (`tsc --noEmit` / `vue-tsc`).
4. Testy jednostkowe/komponentowe (Vitest) + raport coverage.
5. Build produkcyjny (Vite).
6. Testy E2E (Playwright) na zbudowanej aplikacji.
7. Publikacja artefaktów (build, raporty testów) jako wynik pipeline'u.

> Platforma: **GitHub Actions** (workflow w `.github/workflows/`), uruchamiany na push i pull request.

### 7.3 CD i środowiska — cele kolejnych etapów

- **Trzy środowiska:** dev / staging / production (decyzja 8.1).
- **Hosting frontendu: kontener Docker** (obraz z aplikacją serwowaną statycznie, np. przez nginx) — ten sam obraz promowany między środowiskami.
- Promocja tego samego artefaktu między środowiskami (build once, deploy many).
- Konfiguracja per środowisko przez zmienne środowiskowe / sekrety (nigdy w repo).

### 7.4 Definicja ukończenia (Definition of Done) — Etap 1

Etap 1 uznajemy za zakończony, gdy:

- [ ] Aplikacja realizuje FR-1 … FR-7.
- [ ] Działa lint + format check + sprawdzenie typów (`vue-tsc`).
- [ ] Są testy jednostkowe pokrywające logikę i kluczowe komponenty.
- [ ] Jest co najmniej jeden scenariusz E2E (Playwright) przechodzący zielono.
- [ ] Istnieje działający pipeline CI uruchamiający lint + testy + build + E2E.
- [ ] README opisuje uruchomienie lokalne i strukturę projektu.

---

## 8. Decyzje i pytania otwarte

### 8.1 Decyzje podjęte

| # | Temat | Decyzja |
|---|-------|---------|
| 1 | Platforma CI/CD | **GitHub Actions.** |
| 2 | Język | **TypeScript** (zmiana w stosunku do v0.1 — wcześniej zakładano czysty JavaScript). Stos w sekcji 5.1 zaktualizowany. |
| 3 | Menedżer pakietów | **npm.** |
| 4 | Trwałość danych (Etap 1) | **`localStorage`** — bez backendu, dane przetrwają odświeżenie strony (FR-7 staje się wymaganiem obowiązkowym). |
| 5 | Style / UI | **Tailwind CSS.** |
| 6 | Konwencja commitów | **Conventional Commits**, wymuszane lokalnie przez **Husky** (git hooks) + **commitlint**. |
| 7 | Hooki jakości (pre-commit) | **Husky + lint-staged** uruchamiające **ESLint** i **Prettier** na plikach w commicie. |
| 8 | Liczba środowisk | **Trzy:** dev / staging / production. |
| 9 | Cel wdrożenia frontendu | **Kontener Docker** (serwowany np. przez nginx) — środowiska prod-like, CD do własnej infry. |
| 10 | Strategia gałęzi | **GitHub Flow** — krótkie gałęzie + PR do `main`. |

#### Decyzje — Etap 2 (Backend)

| # | Temat | Decyzja |
|---|-------|---------|
| 11 | Backend | **Express + TypeScript**, monorepo `backend/` obok `frontend/` (samodzielny, własny lockfile; bez npm workspaces). |
| 12 | Trwałość (Etap 2) | **Plik JSON na dysku** (`backend/data/profile.json`) — bez DB; MongoDB dopiero Etap 3. |
| 13 | Zdjęcie profilowe | **Osobny plik** na serwerze (multipart upload, limit rozmiaru, tylko obrazy); w JSON-ie ścieżka/URL. |
| 14 | Walidacja email | Również **po stronie serwera** (`PUT /api/profile`), nie tylko na froncie. |
| 15 | Strategia E2E | **Full-stack** — Playwright przeciw prawdziwemu backendowi; reset stanu przez realny `DELETE /api/profile`. |
| 16 | Artefakty buildu | **Build wielu artefaktów:** osobne `frontend-dist` i `backend-dist` (lekkie: `dist` + pliki `package*`, bez `node_modules`). |

#### Decyzje — Etap 3 (MongoDB)

| # | Temat | Decyzja |
|---|-------|---------|
| 17 | Co trafia do Mongo | **Profil** (dokument-singleton `_id:'profile'`); **zdjęcie zostaje plikiem na dysku** (jak Etap 2). |
| 18 | Sterownik / dostęp do bazy | **Mongoose** (ODM); walidacja email pozostaje w **Zod** na granicy HTTP — bez duplikacji w schemacie Mongoose. |
| 19 | Migracje | **migrate-mongo**; migracja #1 = utworzenie kolekcji + idempotentny import legacy `profile.json` (z `down`). |
| 20 | Testy z bazą | **Testcontainers** (`@testcontainers/mongodb`) — realny `mongod` w testach integracyjnych i E2E. |
| 21 | Mongo lokalnie (dev) | **`backend/docker-compose.yml`** z jedną usługą `mongo` + nazwany wolumen; pełny stack (konteneryzacja aplikacji) dopiero Etap 4. |
| 22 | Seedy | **Idempotentny `npm run seed`** (upsert profilu demo dla dev/staging). |

#### Decyzje — Etap 4 (Docker)

| # | Temat | Decyzja |
|---|-------|---------|
| 23 | Zakres `docker compose up` | **Pełny stack**: mongo + backend + frontend-nginx; jedno polecenie = kompletna aplikacja prod-like. |
| 24 | Budowa obrazów | **Multi-stage builds** (builder → runtime) dla backend i frontend; lekkie obrazy bez devDependencies i kodu źródłowego. |
| 25 | Serwowanie frontendu | **nginx:alpine** — pliki statyczne + `proxy_pass /api/ → backend:3000`; SPA routing przez `try_files`. |
| 26 | Rejestr obrazów | **GHCR** (`ghcr.io/{owner}/teamable-{backend,frontend}`); push tylko na `main` po zielonych testach; tag SHA + `latest`. |
| 27 | Non-root w kontenerze | **`USER app`** w obu Dockerfile'ach; `addgroup`/`adduser` na etapie runtime. |
| 28 | Healthchecks | Backend: `/api/health` (Etap 3); Mongo: `mongosh ping`; `depends_on: service_healthy` — deterministyczna kolejność startu. |
| 29 | E2E | **Bez zmian** — Testcontainers jak w Etapie 3; docker-compose to narzędzie dev; smoke testy na compose — Etap 5. |

#### Decyzje — Etap 5 (Wdrożenia / CD)

| # | Temat | Decyzja |
|---|-------|---------|
| 30 | Cel wdrożenia | **Ephemeral w CI**: `compose pull` → `up` → smoke → `down`; nic nie żyje poza pipeline'em. |
| 31 | Trigger CD | `main` → dev + staging (auto, sekwencyjnie, dopiero po udanym CI przez `workflow_run`); tag `v*` → production (approval gate). |
| 32 | Promowany artefakt | **Ten sam obraz GHCR po SHA** (build once, deploy many); deploy nigdy nie buduje. |
| 33 | Sekrety i zmienne | **GitHub Environments** (dev/staging/production); required reviewers na production. |
| 34 | Dane per środowisko | dev/staging: `SEED_ON_START=true` (seed demo); production: czysty start (FR-9). |
| 35 | Flagi runtime | `LOG_LEVEL` per środowisko (konsumowane w Etapie 6); `SEED_ON_START` on/off. |
| 36 | Izolacja środowisk | Osobne compose project (`teamable_dev`/`_staging`/`_production`), różne porty. |
| 37 | Smoke test | `/api/health` + curl frontendu po każdym deployu; błąd czerwieni job. |

#### Decyzje — Etap 6 (Obserwowalność i jakość)

| # | Temat | Decyzja |
|---|-------|---------|
| 38 | Logowanie | **pino** — structured JSON z `requestId`; `LOG_LEVEL` z env (per środowisko). |
| 39 | Metryki | **prom-client** — `GET /api/metrics` (default Node metrics + histogram latencji HTTP). |
| 40 | Stack monitoringu | **Prometheus + Grafana** jako usługi w compose (provisioning datasource + dashboard). |
| 41 | Coverage gate | **Vitest** próg 70% (frontend + backend); spadek łamie CI; raport lcov. |
| 42 | Analiza statyczna #1 | **CodeQL** (GitHub native) — bezpieczeństwo, wynik w zakładce Security. |
| 43 | Analiza statyczna #2 | **SonarCloud** — utrzymywalność, code smells, quality gate; konsumuje lcov. |

### 8.2 Pytania nadal otwarte

Brak — wszystkie kluczowe decyzje na Etap 1 zostały podjęte. Nowe pytania dopisujemy tutaj w miarę rozwoju projektu.
