# Etap 3 — Integracja z MongoDB — projekt techniczny

> **Data:** 2026-06-11
> **Status:** zaakceptowany (gotowy do planu implementacji)
> **Źródło wymagań:** [../../../requirements.md](../../../requirements.md) (Etap 3 w sekcji 2.3)
> **Poprzedni etap:** [spec Etapu 2](2026-06-10-etap2-backend-design.md) · [plan Etapu 2](../plans/2026-06-10-etap2-backend.md)
> **Charakter:** projekt edukacyjny — aplikacja jest poligonem do nauki DevOps. Kod aplikacji minimalny; nacisk na proces: **migracje**, **testy z bazą na kontenerach**, **seedy danych**.

## Cel etapu

Wymienić warstwę trwałości backendu z **pliku JSON na dysku** na **MongoDB**, **bez zmiany zachowania widocznego dla użytkownika**. Cała zmiana jest zamknięta za istniejącym szwem `backend/src/services/profileStore.ts`; frontend i kontrakt API pozostają bez zmian. FR-8…FR-13 zostają w mocy — zmienia się wyłącznie mechanizm trwałości (analogicznie do tego, jak w Etapie 2 plik JSON zastąpił `localStorage`/FR-7).

Cały ciężar edukacyjny jest po stronie DevOps, zgodnie z wierszem Etapu 3 w `requirements.md` (2.3): *„Migracje, testy z bazą (np. kontenery testowe), seedy danych"*.

**Zakres trwałości:** do Mongo trafia **dokument profilu**. **Zdjęcie profilowe zostaje plikiem na dysku** (jak w Etapie 2) — przenosimy do bazy tylko `avatarUrl` jako część dokumentu profilu.

**Poza zakresem tej rundy:** konteneryzacja aplikacji i `docker-compose` całego stacku (Etap 4), CD i wdrożenia na środowiska (Etap 5), MongoDB w GridFS / zdjęcie w bazie, replica set / transakcje, uwierzytelnianie wielu użytkowników.

## Decyzje projektowe (z brainstormingu)

| Temat | Decyzja | Uzasadnienie |
|-------|---------|--------------|
| Co trafia do Mongo | **Profil** (dokument-singleton); **zdjęcie zostaje na dysku** | Mniejsza, skupiona zmiana; upload/serwowanie pliku z Etapu 2 bez zmian. Świadomy koszt: dwa źródła stanu (Mongo + FS) — w Etapie 4 wolumen na avatary obok Mongo |
| Sterownik / dostęp do bazy | **Mongoose** (ODM) | Popularny, dydaktyczny cel: schematy, modele, lifecycle połączenia |
| Walidacja | **Zod na granicy HTTP** (bez zmian) + **schema Mongoose** = definicja dokumentu | Email walidowany **tylko w Zod** (FR-12) — brak duplikacji reguły; Mongoose opisuje kształt przechowywany |
| Migracje | **migrate-mongo** | Standardowe narzędzie: changelog w bazie, `up`/`down`, uruchamiane w CI i przy deployu; migracje na poziomie kolekcji (niezależne od Mongoose) |
| Testy z bazą | **Testcontainers** (`@testcontainers/mongodb`) | Dosłowny match „kontenerów testowych"; realny `mongod`, identycznie lokalnie i w CI (zasada „to samo polecenie", sekcja 6 requirements); prod-like |
| Mongo lokalnie (dev) | **`backend/docker-compose.yml` z jedną usługą `mongo`** + nazwany wolumen | Docker i tak wymagany (Testcontainers); `docker compose up -d`, dane przeżywają restart, stałe `MONGODB_URI`. Etap 4 rozbuduje compose o aplikację i pełny stack |
| Seedy | **Idempotentny `npm run seed`** (upsert profilu demo) | Odtwarzalny stan startowy dla dev/staging; mały, świadomie bez frameworka |
| Mongo w E2E | **Testcontainers w `globalSetup` Playwrighta** + `migrate:up`; reset przez `DELETE /api/profile` | Self-contained full-stack E2E lokalnie i w CI; reuse istniejącego mechanizmu resetu z Etapu 2 |

## Mapowanie nacisku DevOps Etapu 3 → projekt

| Nacisk DevOps | Gdzie w tym projekcie |
|---|---|
| **Migracje** | Sekcja 5 — migrate-mongo; migracja #1 = utworzenie kolekcji + idempotentny import legacy `profile.json` (z działającym `down`); `migrate:up` w bootstrapie testów, E2E i (docelowo) deployu |
| **Testy z bazą (kontenery)** | Sekcja 7 — Testcontainers podnosi realny `mongod` w testach integracyjnych i E2E |
| **Seedy danych** | Sekcja 6 — `npm run seed` jako odtwarzalny stan startowy bazy |

## 1. Architektura i struktura repo

Zmiana jest zamknięta w `backend/`. **Frontend bez zmian** — kontrakt API (`GET/PUT/DELETE /api/profile`, `POST/GET /api/profile/avatar`, `GET /api/health`) identyczny jak w Etapie 2.

```text
teamable/
  backend/
    src/
      index.ts                  # bootstrap: connect do Mongo → listen(); graceful close
      app.ts                    # konfiguracja Express (bez zmian strukturalnych, testowalna bez listen)
      db/connection.ts          # connect/disconnect Mongoose, stan dla /health
      models/Profile.ts         # schema + model Mongoose (singleton _id:'profile', autoIndex:false)
      routes/profile.ts         # bez zmian (woła ten sam profileStore)
      services/profileStore.ts  # TEN SAM szew — wnętrze przepisane z FS na Mongoose (avatar wciąż FS)
      schemas/profile.ts        # Zod ProfileInputSchema — bez zmian
      types/profile.ts          # interface Profile + EMPTY_PROFILE — bez zmian
    migrations/                 # pliki migracji migrate-mongo (#1: kolekcja + import profile.json)
    scripts/seed.ts             # idempotentny seed
    migrate-mongo-config.js     # konfiguracja migrate-mongo (czyta MONGODB_URI)
    docker-compose.yml          # dev: jedna usługa `mongo` + nazwany wolumen
    data/uploads/               # zostaje: pliki avatara (gitignored)
    .env.example                # + MONGODB_URI
  frontend/                     # bez zmian
  .github/workflows/ci.yml      # joby backend/e2e korzystają z Dockera (Testcontainers) + migrate:up
```

Najważniejsza zasada (kontynuacja Etapu 2): **`profileStore.ts` to jedyny moduł, którego wnętrze się zmienia.** `routes/profile.ts`, `app.ts`, schema Zod i kontrakt `Profile` zostają. Dochodzą tylko nowe moduły infrastrukturalne (`db/connection.ts`, `models/Profile.ts`) oraz narzędzia DevOps (migracje, seed, compose).

## 2. Model danych i przechowywanie

Kształt `Profile` **bez zmian** (kontrakt z frontendem niezmieniony):

```ts
interface Profile {
  firstName: string
  lastName: string
  email: string      // walidowany w Zod (FR-12); Mongoose nie duplikuje reguły email
  aboutMe: string
  avatarUrl: string  // ścieżka/URL pliku na backendzie (puste = brak zdjęcia) — semantyka jak Etap 2
}
```

**Dokument-singleton.** Aplikacja jest jednoosobowa → w kolekcji `profiles` żyje **dokładnie jeden** dokument o stałym kluczu `_id: 'profile'`. To czyni operacje deterministycznymi (upsert zawsze trafia w ten sam dokument) i bezpośrednio odwzorowuje semantykę „jednego profilu" z Etapu 2.

- **Mapowanie dokument ↔ `Profile`:** `profileStore` zwraca **czysty kształt `Profile`** (bez `_id`, `__v`) — kontrakt API pozostaje dokładnie taki jak w Etapie 2. Pilnuje tego test kontraktowy (sekcja 7).
- **`autoIndex: false`** w schemacie Mongoose: indeksy nie są budowane automatycznie przy starcie aplikacji (dobra praktyka produkcyjna — kontrola nad budową indeksów). Obecnie singleton nie wymaga indeksów wtórnych (wystarcza automatyczny indeks `_id`); ustawienie jest świadomym domyślnym na przyszłość, a tworzenie ewentualnych indeksów należałoby do migracji, nie do auto-buildu.
- **Zdjęcie pozostaje plikiem na dysku** (`backend/data/uploads/avatar.<ext>`), zarządzane jak w Etapie 2. W dokumencie profilu trzymany jest tylko `avatarUrl` (z cache-bustingiem) — źródło prawdy o tym, czy zdjęcie istnieje.
- **`profile.json` przestaje być zapisywany.** Pozostaje wyłącznie jako **wejście jednorazowej migracji** (sekcja 5); po migracji jest zbędny.

**Atomowość — lekcja ciągłości.** Etap 2 zapewniał spójność zapisu przez `temp + rename` (brak uciętego JSON-a po awarii). W Mongo odpowiednikiem jest **atomowość na poziomie pojedynczego dokumentu**: jeden `findOneAndUpdate`/`replaceOne` jest atomowy, więc częściowy/uszkodzony zapis profilu nie powstaje. Ten sam cel, inny mechanizm — i naturalne przejście od „pliku" do „bazy". Bez transakcji wielodokumentowych (jeden dokument → niepotrzebne; overengineering).

## 3. Warstwa trwałości — ten sam szew (`profileStore.ts`)

Sygnatury funkcji **bez zmian** (router ich nie zauważy); wnętrze przechodzi z FS na Mongoose. Avatar nadal obsługiwany na dysku.

| Funkcja | Etap 2 (plik JSON) | Etap 3 (Mongo) |
|---|---|---|
| `readProfile()` | odczyt `profile.json` ?? `EMPTY_PROFILE` | `findById('profile')` → mapowanie na `Profile` ?? `EMPTY_PROFILE` (FR-9) |
| `writeProfile(input)` | zapis JSON, zachowanie `avatarUrl` | `findOneAndUpdate({_id:'profile'}, {$set: pola tekstowe}, {upsert,new})` — **nie dotyka `avatarUrl`** (FR-8) |
| `saveAvatar(buffer, ext)` | zapis pliku + update `avatarUrl` w JSON | **zapis pliku na dysk jak dziś** + update `avatarUrl` w dokumencie (upsert) |
| `findAvatarPath()` | odczyt katalogu uploads | **bez zmian** (FS) |
| `deleteProfile()` | usunięcie `profile.json` + uploads | `deleteOne({_id:'profile'})` **+ usunięcie pliku avatara** (FR-13) |

- `writeProfile` ustawia tylko `firstName/lastName/email/aboutMe`; przy upsert-insert `avatarUrl` przyjmuje domyślne `''` ze schematu, przy update pozostaje nietknięty — dokładnie semantyka „PUT nie kasuje zdjęcia" z Etapu 2.
- `saveAvatar` **nie zmienia** logiki plikowej (podmiana pliku, usunięcie poprzedniego o innym rozszerzeniu, cache-busting `?v=`) — zmienia się tylko miejsce zapisu `avatarUrl` (dokument zamiast JSON).
- Funkcje pozostają testowalne jednostkowo (mock warstwy Mongoose) i integracyjnie (realny `mongod` z Testcontainers).

## 4. Połączenie, health, konfiguracja

- **`db/connection.ts`:** `connectDb()` (`mongoose.connect(MONGODB_URI)`), `disconnectDb()` (`mongoose.disconnect()`), helper stanu połączenia dla health.
- **`index.ts`:** `await connectDb()` **przed** `listen()`; na `SIGTERM`/`SIGINT` graceful: zamknięcie serwera + `disconnectDb()`. `app.ts` zostaje czystą konfiguracją Express bez `listen` (testowalność jak w Etapie 2).
- **Konfiguracja przez env:** nowa zmienna **`MONGODB_URI`** (zawiera host, port i nazwę bazy). `PROFILE_DATA_DIR` zostaje (katalog uploadów avatara). `.env.example` zaktualizowany.
- **`GET /api/health`** rozszerzony: zwraca `200 {status:'ok'}` **tylko gdy połączenie z Mongo jest aktywne** (`readyState`/ping); w przeciwnym razie `503`. Używane przez `wait-on` w CI, a w Etapie 4 jako healthcheck kontenera.

## 5. Migracje (migrate-mongo)

- **`migrate-mongo-config.js`** czyta `MONGODB_URI` (URL i nazwa bazy z env, nie zaszyte w repo). migrate-mongo prowadzi w bazie kolekcję-changelog śledzącą zastosowane migracje.
- **Skrypty:** `migrate:up`, `migrate:down`, `migrate:status`.
- **Migracja #1 — „plik → baza":**
  - `up`: utwórz kolekcję `profiles`; jeśli istnieje legacy `backend/data/profile.json` **i** brak dokumentu `_id:'profile'` → zaimportuj jego zawartość jako dokument singleton. **Idempotentna** i **bezpieczna na pustej bazie** (brak pliku / brak danych → nic nie robi; CI i świeże środowiska przechodzą bez błędu).
  - `down`: usuń dokument `_id:'profile'` (cofnięcie importu).
  - To jest **autentyczna migracja danych**: realnie przenosi stan z Etapu 2 do Mongo na maszynie dewelopera, a jednocześnie uczy mechaniki up/down i changelogu.
- **`migrate:up` jako część bootstrapu:** uruchamiane w setupie testów integracyjnych i E2E (po starcie kontenera Mongo) oraz docelowo w kroku deployu (Etap 5). Dzięki temu testy zawsze biegną na „zmigrowanej" bazie, a migracje są ciągle weryfikowane.
- **Uwaga implementacyjna (do planu):** projekt jest ESM/TypeScript, a migrate-mongo domyślnie ładuje migracje jako pliki CommonJS/JS — interop (format pliku migracji / loader) rozstrzygamy w planie implementacji.

## 6. Seedy danych

- **`npm run seed`** (`scripts/seed.ts`): **idempotentny** upsert dokumentu profilu demo (np. „Jan Kowalski") — odtwarzalny stan startowy dla dev/staging i do ręcznych prób.
- Świadomie **bez frameworka do seedów** (jeden dokument; framework byłby overengineeringiem). Seed jest rozdzielony od migracji: migracje = zmiany strukturalne/przeniesienie danych, seed = wygodne dane przykładowe.

## 7. Strategia testów

- **Backend unit:** `profileStore` na mockowanej warstwie Mongoose/modelu — logika niezależna od bazy: brak dokumentu → `EMPTY_PROFILE` (FR-9), `writeProfile` zachowuje `avatarUrl` (FR-8), `deleteProfile` usuwa dokument i plik (FR-13), mapowanie dokument→`Profile` (brak `_id`/`__v`). Schema Zod — testy bez zmian z Etapu 2.
- **Backend integracyjne (Testcontainers + supertest):** `globalSetup` Vitest podnosi **realny `mongod`** (`@testcontainers/mongodb`), ustawia `MONGODB_URI`, wykonuje `migrate:up`; suite łączy Mongoose; **reset między testami przez wyczyszczenie kolekcji** (`deleteMany`). Scenariusze jak w Etapie 2 (na realnej bazie): `GET` pusty profil; `PUT` poprawny / zły email (400) / whitelist pól (strip); `POST`/`GET` avatar (200 + cache-busting / nie-obraz 400 / za duży 413 / brak pliku 404); `DELETE` reset + **idempotencja**; jednolity format błędu `{ error }`; **test kontraktowy kształtu `Profile`**. `globalTeardown` zatrzymuje kontener.
- **Frontend unit/komponenty:** **bez zmian** — kontrakt API ten sam, `profileService` (mock `fetch`) i `useProfile` jak w Etapie 2.
- **Full-stack E2E (Playwright):** `globalSetup` podnosi Mongo z Testcontainers, wykonuje `migrate:up` i przekazuje `MONGODB_URI` do backendu uruchamianego przez `webServer`; `globalTeardown` zatrzymuje kontener. `beforeEach` resetuje stan przez **`DELETE /api/profile`** (jak w Etapie 2). Scenariusze bez zmian: edycja+zapis utrwala po reloadzie (teraz przez Mongo), zły email blokuje zapis, upload + trwałość zdjęcia, „Anuluj" nie utrwala, pusty profil na czystym stanie (FR-9).

Reguła „każde FR ma ≥ 1 test" (sekcja 6 requirements) — utrzymana; pokrycie to te same FR co w Etapie 2, ale weryfikowane na bazie Mongo:

| FR | Pokrycie testem (Etap 3) |
|---|---|
| FR-8 (trwałość przez backend) | integ. `PUT`+`GET` na Mongo; E2E zapis+reload |
| FR-9 (pierwsze uruchomienie = pusto) | unit brak dokumentu→`EMPTY_PROFILE`; integ. `GET`; E2E czysty stan |
| FR-10 (upload + serwowanie zdjęcia) | integ. `POST`/`GET avatar` (plik na dysku, `avatarUrl` w Mongo); E2E upload + reload |
| FR-11 („Anuluj" bez utrwalania) | E2E „Anuluj"; logika avatara bez zmian z Etapu 2 |
| FR-12 (walidacja email na serwerze) | integ. `PUT` zły email → 400 (Zod); unit schema Zod |
| FR-13 (usunięcie profilu) | integ. `DELETE` reset + idempotencja (dokument + plik); E2E `beforeEach` |

## 8. CI/CD

- **frontend job:** bez zmian (lint, format, type-check, unit + coverage, build, artefakt `frontend-dist`).
- **backend job:** runner GitHub Actions ma Dockera → **Testcontainers działa out-of-the-box**. Install, lint, format, type-check, **unit + integracyjne (Testcontainers podnosi `mongod`, `migrate:up` w setupie) + coverage**, build (`tsc`). Artefakt **`backend-dist`** = `dist/` + `package*` **+ `migrations/` + `migrate-mongo-config.js`**, by środowisko docelowe mogło uruchomić `migrate:up`.
- **e2e job:** `needs: [frontend, backend]`; Mongo z Testcontainers w `globalSetup`, `migrate:up`, backend + frontend preview, **czeka aż `GET /api/health` (z pingiem DB) zwróci 200**, odpala full-stack Playwright → artefakt `playwright-report`.
- **Migracje weryfikowane ciągle:** ponieważ testy integracyjne i E2E biegną po `migrate:up`, każdy build sprawdza, że migracje stosują się na czystej bazie. Wersjonowanie/promocja artefaktów i odpalanie migracji przy realnym deployu — świadomie odłożone do Etapu 5.

## 9. Konfiguracja, zależności, pozostałe

- **Zależności backend:** dodać **`mongoose`** (prod) oraz **`migrate-mongo`** (prod — musi być dostępne w artefakcie, by uruchomić migracje przy deployu po `npm ci`). Dev: **`@testcontainers/mongodb`** (tylko testy). `multer`, `cors`, `zod`, `express` — bez zmian.
- **Skrypty backendu:** dodać `migrate:up`, `migrate:down`, `migrate:status`, `seed`; istniejące (`dev`, `build`, `start`, `test`, `test:integration`, `test:coverage`, `lint`) bez zmian.
- **`backend/docker-compose.yml`:** jedna usługa `mongo` (oficjalny obraz) + nazwany wolumen na dane + mapowanie portu; `docker compose up -d` dla dev. (Pełny stack aplikacji — Etap 4.)
- **`.env.example`:** dodać `MONGODB_URI` (np. `mongodb://localhost:27017/teamable`); zachować `PORT`, `PROFILE_DATA_DIR`; front `VITE_API_BASE_URL` bez zmian.
- **`.gitignore`:** `backend/data/` (avatary) i `backend/dist/` już ignorowane; wolumen Mongo jest wolumenem Dockera (poza repo).
- **README:** uruchomienie Mongo dla dev (`docker compose up -d`), `MONGODB_URI`, polecenia `migrate:up`/`seed`, krótka nota o testach na Testcontainers (wymagany Docker lokalnie).

## 10. Zmiany kontraktu danych i requirements

- **Kontrakt `Profile`: bez zmian.** Kształt i semantyka `avatarUrl` (ścieżka/URL pliku na backendzie, puste = brak) **identyczne jak w Etapie 2**. Zmienia się wyłącznie backend trwałości.
- **`requirements.md`:**
  - sekcja 2.4 — dodać wiersz z linkiem do tego specu;
  - sekcja 5.4 — nota: źródłem prawdy profilu jest teraz **dokument MongoDB** (zdjęcie nadal plik na dysku); kształt kontraktu bez zmian;
  - sekcja 8.1 — dodać blok **„Decyzje — Etap 3"** (tabela decyzji z tego specu);
  - mechanizm trwałości FR-8 (**plik JSON**) zostaje **zastąpiony przez MongoDB** — analogicznie do tego, jak FR-8 zastąpił `localStorage` z FR-7.

## 11. Definicja ukończenia (Definition of Done) — Etap 3

- [ ] Profil utrwalany w **MongoDB** (dokument-singleton `_id:'profile'`) przez Mongoose; zachowanie API i kontrakt `Profile` identyczne jak w Etapie 2.
- [ ] `profileStore` przepisany za **tym samym szwem** (sygnatury bez zmian); `routes`, `app.ts`, Zod i kontrakt `Profile` niezmienione; zdjęcie nadal plikiem na dysku.
- [ ] FR-8…FR-13 zachowane: trwałość (FR-8), pierwsze uruchomienie = pusty profil (FR-9), upload+serwowanie zdjęcia (FR-10), „Anuluj" bez utrwalania (FR-11), walidacja email po stronie serwera w Zod (FR-12), `DELETE` reset + idempotencja, w tym usunięcie pliku avatara (FR-13).
- [ ] **Połączenie z Mongo** w bootstrapie (connect → listen, graceful close); `GET /api/health` zwraca 200 tylko przy aktywnym połączeniu.
- [ ] **migrate-mongo** skonfigurowane (config czyta `MONGODB_URI`); **migracja #1** importuje legacy `profile.json` idempotentnie, bezpieczna na pustej bazie, z działającym `down`; skrypty `migrate:up/down/status`.
- [ ] **Seed** (`npm run seed`) idempotentny.
- [ ] **Testy z bazą na Testcontainers:** backend integracyjne (realny `mongod`, `migrate:up`, reset kolekcji) + coverage; full-stack E2E (Mongo w `globalSetup`, reset przez `DELETE`); frontend unit bez zmian — zielone lokalnie i w CI; każde FR-8…FR-13 ma ≥ 1 test.
- [ ] **CI:** joby frontend + backend + e2e; backend/e2e używają Dockera (Testcontainers); `backend-dist` zawiera `migrations/` + config; e2e czeka na `/api/health` z pingiem DB.
- [ ] **Dev:** `backend/docker-compose.yml` podnosi Mongo (`docker compose up -d`); `.env.example` z `MONGODB_URI`; README zaktualizowane.
- [ ] **`requirements.md`** zaktualizowane (2.4 link, 5.4 nota, decyzje Etap 3, supersedowanie mechanizmu FR-8).

## 12. Poza zakresem (świadomie odłożone)

- Konteneryzacja **aplikacji** i `docker-compose` całego stacku (Etap 4) — tu compose dotyczy **tylko usługi Mongo dla dev**.
- CD, wdrożenia dev/staging/prod, promocja/wersjonowanie artefaktów, odpalanie `migrate:up` przy realnym deployu (Etap 5).
- Zdjęcie w MongoDB / GridFS (zostaje na dysku), replica set, transakcje wielodokumentowe (jeden dokument → niepotrzebne).
- Uwierzytelnianie do Mongo ponad `MONGODB_URI`, wielu użytkowników, wiele profili, indeksy wtórne bez realnego zapotrzebowania na zapytania, framework do seedów, ODM-owa walidacja email dublująca Zod.
