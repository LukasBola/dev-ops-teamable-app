# Etap 4.5 — Uwierzytelnianie (Better Auth) i profile per użytkownik — projekt techniczny

> **Status:** projekt do akceptacji
> **Data:** 2026-11-22
> **Wzorzec referencyjny:** projekt `codewithmosh/helpdesk` — spec `2026-07-28-better-auth-migration-design.md` (rewizja 2 + poprawki po review PR #8) oraz ADR-0006…0009.
> **ADR-y:** [0001](../../adr/0001-better-auth.md), [0002](../../adr/0002-jeden-origin-spa-api.md), [0003](../../adr/0003-ochrona-csrf-origin.md), [0004](../../adr/0004-walidacja-env-zod.md), [0005](../../adr/0005-profil-per-uzytkownik.md)

---

## 1. Cel etapu (dlaczego)

- Aplikacja **docelowo będzie publiczna w internecie**. Dziś każdy, kto zna adres, może odczytać, nadpisać i usunąć profil (`GET/PUT/DELETE /api/profile` bez żadnej kontroli dostępu). Przed publicznym wdrożeniem i przed CD (Etap 5), które promuje obrazy na production, potrzebna jest kontrola dostępu.
- Aplikacja przestaje być jednoosobowa: logować się będzie **właściciel i inni użytkownicy**, każdy z własnym, **prywatnym** profilem.
- Nacisk edukacyjny/DevOps: sekrety per środowisko (`BETTER_AUTH_SECRET`), walidacja konfiguracji przy starcie, testy integracyjne i E2E z logowaniem, migracja danych przy zmianie modelu.

**Dlaczego wzorzec z helpdesk, a nie kopia specu:** spec helpdesk to *migracja* istniejącego auth (express-session → Better Auth) na Prisma/Postgres, bez frontendu. Teamable nie ma auth, ma Mongo/Mongoose, frontend Vue, Express 5 i profil-singleton. Przenosimy **decyzje i lekcje** (sekcja 3), nie dokument.

## 2. Cele, nie-cele, anty-cele

**Cele**
- Logowanie e-mail + hasło (Better Auth), sesja w ciasteczku, wylogowanie.
- **Zamknięta rejestracja** — brak publicznego sign-up; konta tworzy właściciel przez CLI.
- Profil per użytkownik, prywatny: użytkownik widzi i edytuje **tylko swój** profil i avatar.
- Jeden origin dla SPA i API; usunięcie `cors()`; ochrona CSRF przez `Origin`.
- Walidacja env przez Zod przy starcie backendu.
- Testy na wszystkich poziomach piramidy obejmujące auth; E2E z logowaniem.

**Nie-cele (świadomie odłożone)**
- Publiczna rejestracja, weryfikacja e-mail, reset hasła mailem (wymagałyby dostawcy maili) — reset hasła robi właściciel przez CLI.
- Role, `isBlocked`, panel admina — profile są prywatne, konta zarządzane z CLI, więc role nie mają czego chronić. Wzorzec helpdesk (role/`isBlocked` jako `additionalFields` + `databaseHooks`) dodamy, gdy pojawi się panel admina.
- OAuth, 2FA, passkeys (później jako pluginy Better Auth, bez zmiany fundamentu).
- Publiczne profile, katalog użytkowników, routing (`vue-router`).
- Zmiana e-maila logowania przez użytkownika.

**Anty-cele (porażka mimo „działa")**
- Jakikolwiek endpoint profilu/avatara dostępny bez sesji albo dający dostęp do cudzego profilu (IDOR).
- Publiczny `POST /api/auth/sign-up/email` (lekcja helpdesk: bez `disableSignUp` każdy mógł założyć konto).
- Sekret auth w repo, w obrazie Docker lub z wartością domyślną w kodzie produkcyjnym.
- Utrata danych dev: istniejący profil-singleton i avatar znikają bez śladu.
- Własna implementacja hashowania haseł/sesji obok Better Auth.

## 3. Co przenosimy z helpdesk (i co zmieniamy)

| Wzorzec helpdesk | W Teamable |
|---|---|
| `emailAndPassword: { enabled, disableSignUp: true }` | **bez zmian**. `disableSignUp` blokuje też `auth.api.signUpEmail()` po stronie serwera → CLI/seed/testy go nie używają. |
| `createCredentialUser()` — hash przez `(await auth.$context).password.hash()` + utworzenie `user` + `account { providerId: 'credential' }` | **bez zmian koncepcyjnie**, wersja Mongo (`backend/src/auth/users.ts`). Polityka haseł 8–128 znaków (`PASSWORD_LENGTH`), walidacja e-maila, e-mail normalizowany do lowercase. |
| Blokada w `databaseHooks.session.create.before` (brak timing leaka) | **odłożone** razem z `isBlocked` (nie-cel). Zapisane w ADR-0001 jako wzorzec na przyszłość. |
| Bez `session.cookieCache` | **bez zmian** — usunięcie konta ma od razu unieważniać dostęp. |
| Mount `toNodeHandler(auth)` przed `express.json()` | Express 5: `app.all('/api/auth/*splat', toNodeHandler(auth))` *(zweryfikowane w docs Better Auth, Context7, 2026-11-22)*. |
| Middleware `requireAuth` z `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`, `req.currentUser`, `next(err)` przy wyjątku | **bez zmian**, bez `requireRole`. Express 5 sam łapie odrzucone promise'y, ale `next(err)` zostaje jawnie (spójność, testowalność). |
| Jeden origin (ADR-0007): klient bez `baseURL`, proxy Vite w dev, nginx w prod | **bez zmian** — Teamable już tak działa (proxy Vite, nginx `/api/`). Dodatkowo usuwamy `cors()` i `VITE_API_BASE_URL`. |
| `originCheck` na mutacje `/api` (ADR-0008) | **bez zmian**. |
| Env przez Zod (ADR-0009) | **bez zmian** — nowy `backend/src/env.ts`. |
| `trustedOrigins: [CLIENT_URL]` | **upraszczamy**: `BETTER_AUTH_URL` = publiczny origin aplikacji (origin frontendu, bo API idzie przez ten sam origin) → Better Auth ufa mu domyślnie; osobny `CLIENT_URL` niepotrzebny. *(Do weryfikacji przez wykonawcę: zachowanie z proxy Vite, gdzie `Origin` = origin dev serwera.)* |
| Testy: middleware (mock `getSession`), `auth.api` bez HTTP, integracja supertest, helper `signIn()` | **bez zmian**, plus testy izolacji profili (IDOR). |

**Nowe względem helpdesk:**
- **Adapter MongoDB** reużywający połączenia Mongoose: `mongodbAdapter(mongoose.connection.db)` — **bez** przekazywania `client`. *(Zweryfikowane w docs: przekazanie `client` włącza transakcje domyślnie, a transakcje wymagają replica setu; `mongo:7` w compose to standalone.)* Konsekwencja: tworzenie `user` + `account` w CLI nie jest atomowe — CLI sprząta częściowy stan przy błędzie. Instancja `auth` tworzona po `connectDb()` (fabryka/leniwa inicjalizacja — szczegół dla wykonawcy).
- Frontend Vue: `createAuthClient` z `better-auth/vue`, `useSession`, ekran logowania.
- Model profilu per użytkownik + migracja singletonu (sekcja 5).

## 4. Rozważane podejścia (model danych profilu)

| Podejście | Kompromis |
|---|---|
| **A. Osobna kolekcja `profiles`, `_id = userId`** ✅ | Better Auth = tylko konto/sesja. Endpointy `/api/profile`, kontrakt `Profile`, Zod, migracje i większość testów zostają. Koszt: dane użytkownika w dwóch miejscach (konto i profil). |
| B. Pola profilu jako `user.additionalFields` Better Auth | Mniej kolekcji, ale wyrzucamy endpointy, Zod i kontrakt; walidacja w hookach Better Auth (w helpdesk niezgrabna — ręczna walidacja `name` w `hooks.before`); avatar i tak potrzebuje własnego endpointu. |
| C. Profil zagnieżdżony w dokumencie usera | Wady B bez przewagi nad A. Odrzucone. |

**Wybrane: A** (decyzja użytkownika). Uzasadnienie w ADR-0005.

## 5. Model danych

**Kolekcje Better Auth** (tworzone przez adapter): `user`, `session`, `account`, `verification`.

**`profiles`** (istniejąca kolekcja, zmiana klucza):

```ts
interface ProfileDoc {
  _id: string        // = user.id z Better Auth (było: stała 'profile')
  firstName: string
  lastName: string
  email: string      // e-mail KONTAKTOWY, edytowalny (FR-4/6/12 bez zmian); przy utworzeniu konta = e-mail logowania
  aboutMe: string
  avatarUrl: string
}
```

- Kontrakt HTTP `Profile` (5.4 w `requirements.md`) **bez zmian** — `_id` nie wychodzi na zewnątrz.
- **Avatar:** `uploads/<userId>/avatar.<ext>` (było: `uploads/avatar.<ext>`). `userId` przed użyciem w ścieżce walidowany wzorcem formatu ID (obrona przed path traversal, mimo że ID pochodzi z sesji). `avatarUrl` nadal `/api/profile/avatar?v=<ts>` — URL ten sam dla każdego użytkownika, serwer wybiera plik po sesji.
- **`DELETE /api/profile` (FR-13):** czyści **własny** profil i katalog avatara użytkownika; konto zostaje.
- **Usunięcie konta (CLI):** usuwa `user`, `account`, `session` (sesje → natychmiastowa utrata dostępu), profil i katalog avatara.

**Migracja danych istniejących (singleton → per user)** — *moja decyzja:*
- Dziś: dokument `profiles { _id: 'profile' }` + `uploads/avatar.<ext>`.
- Przejmuje je **pierwsze wywołanie `user:create`, które zastanie singleton** — niezależnie od tego, czy istnieją już inni userzy (np. demo-user z seeda): nowy dokument `_id = userId` z polami singletonu, usunięcie singletonu, przeniesienie pliku avatara do `uploads/<userId>/`. Idempotentne (po przejęciu singletonu już nie ma). **Seed nigdy nie przejmuje ani nie usuwa singletonu.** Jeśli singleton zawiera stare dane demo (Jan Kowalski z dotychczasowego seeda), właściciel dostaje je jako swój profil i może je zmienić lub zresetować (FR-13) — świadomy kompromis, dane nie znikają bez śladu. CLI wypisuje informację o przejęciu.
- Produkcja startuje czysto (Etap 5, decyzja 34), więc dotyczy głównie dev/staging.
- Migracja `migrate-mongo` #2: tylko to, czego wymaga Better Auth i model (np. unikalny indeks `user.email`, jeśli adapter go nie tworzy — do weryfikacji przez wykonawcę). Logika przejęcia singletonu siedzi w CLI, bo zależy od userId, którego migracja nie zna.

## 6. Backend

### 6.1 Pliki

```
backend/src/
  env.ts                    # NOWY — Zod: MONGODB_URI, PORT, PROFILE_DATA_DIR, BETTER_AUTH_SECRET, BETTER_AUTH_URL, (SEED_*)
  auth/
    auth.ts                 # NOWY — betterAuth({...}), fabryka po connectDb()
    users.ts                # NOWY — createCredentialUser, deleteUser, setPassword, adoptLegacyProfile
  middleware/
    requireAuth.ts          # NOWY — getSession → req.currentUser | 401
    originCheck.ts          # NOWY — mutacje /api z obcym Origin → 403
  types/express.d.ts        # NOWY — req.currentUser
  app.ts                    # ZMIANA — bez cors(); auth handler przed express.json(); originCheck; requireAuth na /api/profile
  routes/profile.ts         # ZMIANA — userId z req.currentUser
  services/profileStore.ts  # ZMIANA — wszystkie funkcje przyjmują userId; ścieżki avatara per user
  models/Profile.ts         # ZMIANA — bez stałej PROFILE_ID jako default
  services/seedProfile.ts   # ZMIANA — seed tworzy demo-usera + jego profil
backend/scripts/
  user.ts                   # NOWY — CLI: create | delete | set-password
```

`package.json`: dochodzi `better-auth` (pinned, jak w helpdesk), odchodzi `cors` i `@types/cors`. Skrypty: `npm run user:create -- --email … --password …`, `user:delete`, `user:set-password`. W obrazie Docker CLI musi być dostępne (`docker compose exec backend node dist/scripts/user.js …` lub równoważne — szczegół dla wykonawcy).

### 6.2 Konfiguracja Better Auth (szkic)

```ts
betterAuth({
  database: mongodbAdapter(mongoose.connection.db),   // bez client → bez transakcji (standalone mongo)
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
})
```

- **Rate limiting:** Better Auth włącza go domyślnie w produkcji (100 żądań / 10 s; wrażliwe endpointy jak `/sign-in` 3 / 10 s). Zostawiamy domyślne limity; storage `memory` wystarczy (jedna instancja backendu, reset przy restarcie akceptowalny). **IP klienta:** `advanced.ipAddress.ipAddressHeaders: ['x-real-ip']` — *moja decyzja*: nginx **nadpisuje** `X-Real-IP` wartością `$remote_addr`, więc klient nie może go sfałszować; `X-Forwarded-For` nginx tylko dopisuje (`$proxy_add_x_forwarded_for`), więc jego pierwsza wartość pochodzi od klienta — nie używamy. Warunek: port backendu nie jest publikowany poza sieć compose (dziś nie jest) — zapisane w specu Etapu 5.
- **Ciasteczka:** domyślnie `httpOnly`, `SameSite=Lax`, a przy `https` w `BETTER_AUTH_URL` — `Secure` i prefiks `__Secure-` *(skill `better-auth-security-best-practices`)*. Efemeryczne środowiska Etapu 5 działają po http → bez `Secure`; publiczne wdrożenie musi mieć `https` w `BETTER_AUTH_URL`.
- **Sesja:** domyślne `expiresIn` 7 dni, `updateAge` 24 h — bez zmian.
- **Sekret:** Better Auth odrzuca placeholderowe sekrety w produkcji i ostrzega przy <32 znakach — spójne z walidacją w `env.ts`. Generowanie: `openssl rand -base64 32`.
- **Audit log** (logowania, unieważnienia sesji przez `databaseHooks`) — odłożone do Etapu 6 (pino).

### 6.3 Kolejność middleware w `app.ts`

```
app.all('/api/auth/*splat', toNodeHandler(auth))   // przed express.json()
app.use(express.json())
app.use('/api', originCheck)
app.get('/api/health', …)                          // publiczny (healthchecki, smoke Etapu 5)
app.use('/api/profile', requireAuth, profileRouter)
app.use(errorHandler)
```

### 6.4 `originCheck`

Dla metod innych niż GET/HEAD/OPTIONS: jeśli jest nagłówek `Origin` i nie jest originem `BETTER_AUTH_URL` → 403. Brak `Origin` (curl, supertest, server-to-server) przechodzi — ochronę daje wtedy brak ciasteczka / `SameSite=Lax`. Jak w helpdesk ADR-0008.

### 6.5 Env (`env.ts`)

| Zmienna | Reguła |
|---|---|
| `MONGODB_URI` | wymagana |
| `PORT` | domyślnie 3001 |
| `PROFILE_DATA_DIR` | opcjonalna |
| `BETTER_AUTH_SECRET` | wymagana, min. 32 znaki; **brak wartości domyślnej** |
| `BETTER_AUTH_URL` | wymagana, poprawny URL (publiczny origin aplikacji) |
| `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` | wymagane tylko gdy seed jest uruchamiany (`npm run seed` / `SEED_ON_START=true`) |

Błąd walidacji → backend nie startuje, czytelny komunikat. Reszta kodu czyta konfigurację wyłącznie z `env`.

**Sekrety w compose i CI** (*moja decyzja*, zgodnie z anty-celem „sekret w repo"):
- Żaden sekret — także dev — nie jest commitowany. `docker-compose.yml` używa `BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET:?ustaw w .env}` (compose przerywa start, jeśli brak), `BETTER_AUTH_URL: ${BETTER_AUTH_URL:-http://localhost:8080}`.
- Nowy `.env.example` w katalogu głównym (placeholder + instrukcja `openssl rand -base64 32`); `.env` w `.gitignore`. README: krok `cp .env.example .env` przed `docker compose up`.
- `backend/.env.example` — te same zmienne dla `npm run dev`.
- CI: job E2E generuje losowy sekret w kroku (`openssl rand`); job `docker` tylko buduje obrazy, nie uruchamia compose — bez zmian.

**Seed demo-usera** (`npm run seed`, `SEED_ON_START=true`) — kontrakt idempotentności (*moja decyzja*):
- brak usera `DEMO_USER_EMAIL` → utwórz konto + profil demo (e-mail kontaktowy = `DEMO_USER_EMAIL`);
- user istnieje → ustaw hasło na bieżące `DEMO_USER_PASSWORD` (rotacja sekretu w Environment działa przy następnym starcie) i nadpisz profil wartościami demo (jak dzisiejszy upsert — demo to dane resetowalne, edycje demo nie przeżywają restartu).

## 7. Frontend

- `frontend/src/services/authClient.ts` — `createAuthClient()` z `better-auth/vue`, **bez `baseURL`** (ten sam origin).
- `App.vue`: `authClient.useSession()` →
  - `isPending` → „Wczytywanie…",
  - brak sesji → `LoginForm` (e-mail, hasło, komunikat błędu, przycisk „Zaloguj"),
  - sesja → dotychczasowy widok profilu + przycisk **„Wyloguj"** (np. w `ProfileCard`/nagłówku).
- `useProfile`: ładowanie profilu dopiero przy zalogowanym użytkowniku (dziś `load()` startuje w konstruktorze composable'a). Po wylogowaniu stan profilu czyszczony (brak „przecieku" danych poprzedniego użytkownika w pamięci SPA).
- `profileService`: odpowiedź **401** → `ApiError(401)`; warstwa wyżej odświeża sesję (`refetch`) → widok logowania. Usunięcie `VITE_API_BASE_URL` (cross-origin nieobsługiwany, ADR-0002).
- Wygląd i dostępność wg 5.2 `requirements.md` (etykiety, klawiatura, Tailwind). Szczegóły layoutu `LoginForm` — wykonawca, w stylu `ProfileForm`.

```
┌──────────────────────────────┐
│  Teamable                    │
│                              │
│  E-mail   [______________]   │
│  Hasło    [______________]   │
│                              │
│  ⚠ Niepoprawny e-mail lub    │
│    hasło                     │
│            [ Zaloguj ]       │
└──────────────────────────────┘
```

## 8. Nowe wymagania funkcjonalne (do `requirements.md` 4.2)

| ID | Wymaganie | Kryterium akceptacji |
|---|---|---|
| FR-14 | Logowanie e-mail + hasło. | Poprawne dane → widok profilu; złe → komunikat „Niepoprawny e-mail lub hasło", bez ujawniania, czy konto istnieje. |
| FR-15 | Niezalogowany widzi tylko ekran logowania; API profilu bez sesji zwraca 401. | `GET/PUT/DELETE /api/profile` i `/api/profile/avatar` bez ciasteczka → 401. |
| FR-16 | Wylogowanie. | Po „Wyloguj" widok logowania; stare ciasteczko nie daje dostępu do API. |
| FR-17 | Brak publicznej rejestracji; konta tworzy, usuwa i resetuje im hasło właściciel przez CLI. Reset hasła unieważnia wszystkie istniejące sesje użytkownika. | `POST /api/auth/sign-up/email` odrzucony; `user:create` tworzy konto, które może się zalogować; po `user:set-password` stare ciasteczko → 401. |
| FR-18 | Profil i avatar są prywatne: użytkownik widzi i zmienia wyłącznie własne. | Użytkownik A nie odczyta ani nie zmieni profilu/avatara B żadnym endpointem. |
| FR-19 | Usunięcie konta usuwa profil, avatar i sesje. | Po `user:delete` sesja usuniętego → 401; brak jego dokumentu profilu i katalogu avatara. |

Zmiany istniejących: **FR-9** — nowe konto ma pusty profil z wyjątkiem e-maila kontaktowego = e-mail logowania. **FR-13** — reset dotyczy profilu zalogowanego użytkownika. **2.2** — auth i wielu użytkowników przechodzą do zakresu (Etap 4.5).

## 9. Testy

**Backend (Vitest + Testcontainers, jak dziś)**
- `env` — brak/za krótki `BETTER_AUTH_SECRET` → błąd; poprawny zestaw → obiekt `env`.
- `requireAuth` (mock `getSession`) — brak sesji → 401; sesja → `next()` + `req.currentUser`; wyjątek → `next(err)`.
- `originCheck` — mutacja z obcym `Origin` → 403; z zaufanym → przechodzi; bez `Origin` → przechodzi; GET z obcym → przechodzi.
- `auth/users` (przez `auth.api`, bez HTTP) — utworzone konto loguje się; złe hasło; nieznany e-mail; hasło <8 lub >128 → błąd; e-mail case-insensitive; `signUpEmail` zablokowany; `deleteUser` usuwa sesje/profil/avatar; `setPassword` usuwa sesje; `adoptLegacyProfile` przenosi singleton i plik, idempotentne, działa także gdy istnieje demo-user; seed demo-usera idempotentny (tworzy / resetuje hasło i profil) i nie dotyka singletonu.
- Integracja (supertest) — sign-in 200 + ciasteczko; sign-in 401; `get-session` bez logowania → `null`; sign-out niszczy sesję; `POST /api/auth/sign-up/email` → odrzucony; wszystkie endpointy profilu bez ciasteczka → 401; **izolacja: A i B zalogowani, każdy widzi tylko swoje dane, avatar A niedostępny dla B**; dotychczasowe testy API profilu przechodzą z ciasteczkiem.
- Helper `src/__tests__/helpers/auth.ts` → `signIn(app, email, password)` zwraca nagłówek `Cookie`.

**Frontend (Vitest + VTU)** — `LoginForm` (walidacja, błąd, emit); `App` przełącza widoki wg sesji (mock `authClient`); `useProfile` nie ładuje bez sesji i czyści stan po wylogowaniu; `profileService` 401 → `ApiError(401)`.

**E2E (Playwright, full-stack, Testcontainers jak dziś)**
- Orkiestrator (`backend/scripts/e2e-mongo.ts`) po `migrate:up` tworzy dwóch użytkowników testowych przez CLI/`createCredentialUser`; ustawia `BETTER_AUTH_SECRET` (losowy) i `BETTER_AUTH_URL` = origin `vite preview`.
- Logowanie w `globalSetup` → `storageState` (bez klikania logowania w każdym teście); osobny spec testuje sam ekran logowania i wylogowanie.
- Reset stanu (`DELETE /api/profile`) z ciasteczkiem zalogowanego użytkownika.
- Scenariusze: logowanie/wylogowanie (FR-14/16), niezalogowany widzi logowanie (FR-15), dotychczasowe scenariusze profilu po zalogowaniu, izolacja A/B przez API (FR-18).

**Pokrycie wymagań:** każde FR-14…FR-19 ma co najmniej jeden test (zasada z sekcji 6 `requirements.md`).

## 10. Wpływ na inne etapy i dokumenty

- **Etap 5 (CD):** `BETTER_AUTH_SECRET` jako sekret w każdym GitHub Environment (różny per środowisko); `BETTER_AUTH_URL` per środowisko (różne porty, decyzja 36); seed demo (`SEED_ON_START`) tworzy demo-usera — `DEMO_USER_*` z Environment; smoke test bez zmian (`/api/health` publiczny) — opcjonalnie rozszerzony o logowanie demo-userem. Spec Etapu 5 wymaga aktualizacji przed implementacją.
- **Etap 6:** `GET /api/metrics` — decyzja, czy publiczny (spec Etapu 6 zakładał brak auth); logi pino nie mogą zawierać haseł, ciasteczek ani tokenów sesji (redakcja nagłówków `cookie`/`authorization`).
- **Review (issue #5):** obszar N review oceni ten spec. **Plan implementacji powstaje teraz, na podstawie tego specu**; implementacja startuje po przejrzeniu wyników review — jeśli paczka „Auth-prep" coś zmieni, poprawiamy spec i plan przed startem (*moja decyzja*).
- **Zakres dokumentacji w tym etapie:** `requirements.md`, README, ADR-y **oraz** krótkie aktualizacje specu Etapu 5 (sekrety `BETTER_AUTH_*` i `DEMO_USER_*` per Environment, port backendu niepublikowany) i Etapu 6 (decyzja o auth dla `/api/metrics`, redakcja `cookie`/`authorization` w pino) — jako ostatnie zadanie planu, żeby specy nie rozjechały się z kodem.
- **`requirements.md`:** wiersz Etapu 4.5 w 2.3 i 2.4, FR-14…FR-19 (sekcja 4.2), zmiany FR-9/FR-13 i 2.2, nowe decyzje #44+ w 8.1 z linkami do ADR, notka o usunięciu `VITE_API_BASE_URL` w 5.3.
- **README:** jak utworzyć pierwsze konto (`user:create`), nowe zmienne env.

## 11. Co zostaje dla wykonawcy

- Dokładny kształt fabryki `auth` (leniwa inicjalizacja vs `createAuth(db)` wstrzykiwane do `createApp`) — ważne, by testy mogły tworzyć app z własną bazą.
- Format ID użytkownika z adaptera Mongo i odpowiadająca mu walidacja w ścieżce avatara.
- Czy adapter tworzy indeksy (np. unikalny `user.email`); jeśli nie — migracja `migrate-mongo` #2.
- Weryfikacja w docs Better Auth (wersja instalowana): `ipAddressHeaders`, zachowanie `Secure` przy http, domyślne limity rate limitu.
- Wygląd `LoginForm` i umiejscowienie „Wyloguj".
- Sposób wywołania CLI w kontenerze.
- Podział na commity (pre-commit uruchamia tylko lint-staged; CI musi być zielone na końcu brancha).

## 12. Definicja ukończenia

- [ ] FR-14…FR-19 zrealizowane, każde z testem; FR-1…FR-13 nadal zielone (z logowaniem).
- [ ] Brak `cors` w zależnościach; `originCheck` i `requireAuth` w `app.ts`; `POST /api/auth/sign-up/email` odrzucony (test).
- [ ] Backend nie startuje bez poprawnego `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` (test `env`).
- [ ] Test izolacji A/B zielony (integracja + E2E przez API).
- [ ] CLI `user:create|delete|set-password` działa lokalnie i w kontenerze; przejęcie singletonu działa na danych dev.
- [ ] `docker compose up` + `user:create` → logowanie działa przez nginx (:8080).
- [ ] CI zielone (lint, typecheck, unit, integracja, E2E, docker).
- [ ] `requirements.md`, README, ADR-0001…0005 zaktualizowane (ADR-y → „Zaakceptowany").
