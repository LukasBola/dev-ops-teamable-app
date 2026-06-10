# Etap 2 — Backend Express + API profilu — projekt techniczny

> **Data:** 2026-06-10
> **Status:** zaakceptowany (gotowy do planu implementacji)
> **Źródło wymagań:** [../../../requirements.md](../../../requirements.md) (Etap 2 w sekcji 2.3)
> **Poprzedni etap:** [spec Etapu 1](2026-06-04-etap1-frontend-profilu-design.md) · [plan Etapu 1](../plans/2026-06-04-etap1-frontend-profilu.md)
> **Charakter:** projekt edukacyjny — aplikacja jest poligonem do nauki DevOps. Kod aplikacji minimalny, nacisk na proces (testy integracyjne, kontrakt API, build wielu artefaktów).

## Cel etapu

Dodać backend (Express + TypeScript) z REST API profilu i **trwałością w pliku JSON na dysku** (MongoDB dopiero Etap 3). Zdjęcie profilowe przechowywane jako **osobny plik** na serwerze. Frontend integruje się z API przez istniejący szew `profileService.ts` — komponenty bez zmian strukturalnych. Pipeline CI rozszerzony o backend, **build dwóch artefaktów** i **full-stack E2E**.

**Poza zakresem tej rundy:** Docker/konteneryzacja (Etap 4), CD i wdrożenia na środowiska (Etap 5), MongoDB (Etap 3), uwierzytelnianie / wielu użytkowników.

## Decyzje projektowe (z brainstormingu)

| Temat | Decyzja | Uzasadnienie |
|-------|---------|--------------|
| Przechowywanie zdjęcia | **Osobny plik** (multipart upload), ścieżka/URL w JSON | Realistyczne dla DevOps (storage, statyczne serwowanie, później CDN); ćwiczy upload i walidację pliku |
| Język backendu | **TypeScript** | Spójność z frontendem, wspólny kontrakt `Profile`, type-check w CI |
| Strategia E2E | **Full-stack** (Playwright przeciw prawdziwemu backendowi) | Prawdziwa piramida testów; E2E sprawdza realną integrację i trwałość |
| Reset stanu w E2E | **`DELETE /api/profile`** jako realny endpoint | Zarazem normalna operacja REST i mechanizm resetu = stan „pierwsze uruchomienie"; brak test-only smell |
| Artefakty buildu | **Lekkie:** `dist` + pliki `package*` (bez `node_modules`) | Standard; instalacja zależności produkcyjnych przy deployu (Etap 4/5) |
| Trwałość Etap 2 | **Plik JSON na dysku** (`backend/data/profile.json`) + plik zdjęcia | Prosto, bez DB; kontrakt gotowy pod podmianę na Mongo w Etapie 3 |
| Układ repo | **`backend/` obok `frontend/`**, samodzielny (własny `package.json` + lockfile) | Zgodne z obecnym wzorcem; bez npm workspaces (brak overengineeringu) |

## Mapowanie naciski DevOps Etapu 2 → projekt

Wiersz Etapu 2 w `requirements.md` (2.3): *„Testy integracyjne, kontrakt API, build wielu artefaktów"*.

| Nacisk DevOps | Gdzie w tym projekcie |
|---|---|
| **Testy integracyjne** | Sekcja 5 — backend supertest (API ↔ warstwa trwałości) + full-stack E2E |
| **Kontrakt API** | Sekcja 3 (kontrakt) + test kontraktowy kształtu `Profile` w integracji (Sekcja 5) |
| **Build wielu artefaktów** | Sekcja 6 — osobne, niezależnie publikowane artefakty `frontend-dist` i `backend-dist` |

## 1. Architektura i struktura repo

Monorepo zyskuje `backend/` obok `frontend/`. Backend to cienkie API REST; aplikacja jednoosobowa → **jeden profil**, bez ID, bez auth.

```text
teamable/
  backend/
    src/
      index.ts                  # bootstrap: PORT, CORS, listen()
      app.ts                    # konfiguracja Express (eksportowana, testowalna bez listen)
      routes/profile.ts         # GET/PUT/DELETE /api/profile, POST /api/profile/avatar
      services/profileStore.ts  # odczyt/zapis profile.json + plik avatara (FS)
      types/profile.ts          # interface Profile (lustro kontraktu z frontendem)
      schemas/profile.ts        # schema Zod ProfileInputSchema (serwerowa walidacja, FR-12)
    src/__tests__/              # unit + integration (vitest + supertest)
    data/                       # gitignored: profile.json + uploads/avatar.<ext>
    package.json
    tsconfig.json
    eslint.config.js
  frontend/                     # bez zmian strukturalnych — zmienia się tylko profileService
  .github/workflows/ci.yml      # rozszerzony o joby backend + e2e
```

Najważniejsza zasada: **`frontend/src/services/profileService.ts` to jedyny szew, który się zmienia** — z `localStorage` na HTTP. `ProfileCard` i `ProfileForm` zostają (poza obsługą async). Realizacja sekcji 5.3 requirements.

## 2. Model danych i przechowywanie

Kształt `Profile` bez zmian, ale **semantyka `avatarUrl`**: zamiast base64 data URL trzyma ścieżkę serwowaną przez backend (np. `/api/profile/avatar`). Pusty string = brak zdjęcia.

```ts
interface Profile {
  firstName: string
  lastName: string
  email: string      // walidowany format (FR-6 front, FR-12 serwer)
  aboutMe: string
  avatarUrl: string  // Etap 2: ścieżka/URL pliku na backendzie (puste = brak zdjęcia)
}
```

Na dysku (`backend/data/`, gitignored):
- `profile.json` — pola profilu (w tym `avatarUrl` — źródło prawdy o tym, czy zdjęcie istnieje)
- `uploads/avatar.<ext>` — plik zdjęcia (jedno, stała nazwa bazowa `avatar`)

**Atomowość zapisu `profile.json`:** zapis przez **temp + `rename`** (zapisz do `profile.json.tmp`, potem `fs.rename`). `rename` jest atomowy w obrębie systemu plików → restart/awaria w trakcie zapisu nie zostawia uciętego, niepoprawnego JSON-a. Tanie i dobra lekcja o trwałości (przyda się jako wzorzec przy migracji na Mongo w Etapie 3). Nie wprowadzamy biblioteki do lockowania ani mutexa — aplikacja jest jednoosobowa, brak realnej współbieżności (overengineering).

**Pierwsze uruchomienie / brak pliku** → API zwraca profil z pustymi wartościami (`{firstName:'', …, avatarUrl:''}`), status 200. `DEFAULT_PROFILE` na froncie zmienia się na **pusty** (usuwamy seed „Jan Kowalski"). Realizuje FR-9.

Kontrakt `Profile` żyje w dwóch miejscach (front + back) jako lustro; pilnuje go test kontraktowy w integracji. Bez npm workspaces — zgodnie z zasadą „brak overengineeringu".

## 3. Kontrakt API

Bazowy prefiks `/api`. Treść JSON o ile nie zaznaczono inaczej.

| Metoda | Ścieżka | Opis | Statusy |
|---|---|---|---|
| `GET` | `/api/profile` | Zwraca profil; brak pliku → pusty profil | 200 |
| `PUT` | `/api/profile` | Body = pola profilu **bez `avatarUrl`** (firstName, lastName, email, aboutMe). Walidacja po stronie serwera (FR-12). Zapis `profile.json` (zachowuje istniejące `avatarUrl`), zwraca pełny zapisany profil | 200, 400 |
| `POST` | `/api/profile/avatar` | `multipart/form-data`, pole `avatar`. Tylko obrazy, limit 2 MB. Zapis pliku, aktualizacja `avatarUrl` w `profile.json`, zwraca `{ avatarUrl }` | 200, 400, 413 |
| `GET` | `/api/profile/avatar` | Serwuje zapisany obraz (poprawny `Content-Type` wg typu pliku) | 200, 404 |
| `DELETE` | `/api/profile` | Kasuje `profile.json` + plik zdjęcia → pusty profil (reset / „pierwsze uruchomienie"). **Idempotentny** — gdy nic nie istnieje, też 204 | 204 |
| `GET` | `/api/health` | `{status:'ok'}` — wait-on w CI, później healthcheck Dockera | 200 |

### 3.1 Format odpowiedzi błędów (kontrakt)

Wszystkie błędy (4xx) zwracają **jednolity kształt JSON** — front parsuje jedno pole, niezależnie od endpointu:

```json
{ "error": "krótki, czytelny komunikat" }
```

| Status | Kiedy | Przykład `error` |
|---|---|---|
| 400 | `PUT`: niepoprawny email (FR-12) lub brak wymaganego pola; `POST avatar`: zły typ MIME (nie-obraz) lub brak pliku | `"Niepoprawny adres email"`, `"Dozwolone tylko pliki graficzne"` |
| 413 | `POST avatar`: przekroczony limit 2 MB (`MulterError` `LIMIT_FILE_SIZE`) | `"Plik jest za duży (max 2 MB)"` |
| 404 | `GET avatar`: brak pliku zdjęcia | `"Brak zdjęcia"` |

> **Dlaczego osobne 413 dla rozmiaru:** multer przy przekroczeniu limitu rzuca `MulterError` z kodem `LIMIT_FILE_SIZE`; mapujemy go na 413 (Payload Too Large) w error-middleware, a odrzucenie złego typu z `fileFilter` na 400. Rozdzielenie daje front i testom precyzyjny sygnał.

### 3.2 Walidacja i kształt body `PUT` (schema Zod)

Walidacja body po stronie serwera oparta o **schemę Zod** (`ProfileInputSchema` w `backend/src/schemas/profile.ts`) — deklaratywny, testowalny kontrakt zamiast ręcznych ifów. To zarazem lekcja wzorca „walidacja na granicy systemu", który w Etapie 3 przełoży się na schemat MongoDB.

- Schema definiuje **dokładnie** pola: `firstName`, `lastName`, `aboutMe` (string), `email` (string, pusty **lub** poprawny format — spójność z FR-9; odrzucany tylko niepusty niepoprawny). Tryb `strip` — `avatarUrl` i nieznane pola są odcinane (whitelist), nie trafiają do pliku.
- Parsowanie przez `safeParse`; błąd schemy → 400 z komunikatem w jednolitym formacie `{ error }` (sekcja 3.1).
- Typ `ProfileInput` **wyprowadzany ze schemy** (`z.infer`) — jedno źródło prawdy dla typu i walidacji na backendzie.
- Walidacja formatu email w schemie (`z.email()` / odpowiednik) zastępuje na backendzie ręczne `isValidEmail`; front zachowuje swoje proste `isValidEmail` (FR-6) jako pierwszą linię.
- Brak limitów długości pól tekstowych — świadomie (jednoosobowa aplikacja; patrz sekcja „Poza zakresem").
- `PUT` **nie dotyka `avatarUrl`** — zachowuje wartość już zapisaną. Dzięki temu zapis pól tekstowych nie kasuje zdjęcia.

### 3.3 Avatar — przechowywanie, cache-busting, sprzątanie

- Plik zapisywany pod **stałą nazwą bazową** `avatar` z rozszerzeniem wg typu (`avatar.png` / `avatar.jpg` / …). **Przed zapisem nowego avatara usuwamy poprzedni plik** (dowolne rozszerzenie) → brak osieroconych plików o innym `ext` (spójność z FR-11).
- `avatarUrl` w odpowiedziach zawiera **parametr cache-busting**, np. `/api/profile/avatar?v=<mtime/timestamp>`. Bez tego stała ścieżka byłaby cache'owana przez przeglądarkę i po podmianie zdjęcia user widziałby stare. Ścieżka serwująca ignoruje query (`?v` to tylko sygnał dla cache).
- `GET /api/profile/avatar` ustawia `Content-Type` zgodny z typem zapisanego pliku (np. przez `res.sendFile` / `res.type(ext)`), żeby przeglądarka renderowała obraz poprawnie.

CORS: w **dev** front i back są same-origin dzięki proxy Vite (sekcja 4) → CORS praktycznie zbędny, ale włączony dla origin dev jako wygoda przy bezpośrednim strzelaniu w API. W **E2E** używamy proxy/preview (same-origin) — bez polegania na CORS. Konfiguracja prod (Etap 5) poza zakresem.

## 4. Integracja frontendu

- Nowa zmienna `VITE_API_BASE_URL` + `.env.example`. W dev: **proxy Vite** `/api` → backend (same-origin, brak CORS w dev); build używa `VITE_API_BASE_URL`.
- `profileService.ts` przepisany na `fetch` — **async**: `getProfile()`, `saveProfile(profile)`, `uploadAvatar(file)`, `deleteProfile()`. Sygnatury async zachowują dotychczasowy kontrakt szwu (komponenty wołają te same nazwy) — realizacja 5.3 requirements.
- **Obsługa błędów w `profileService` (kontrakt szwu):** każda funkcja sprawdza `response.ok`. Przy błędzie parsuje `{ error }` (sekcja 3.1) i rzuca wyjątek z tym komunikatem (np. `ApiError` z `status` + `message`). Błąd sieci (`fetch` reject) → wyjątek z generycznym komunikatem. Dzięki temu warstwa wyżej ma **jeden, przewidywalny sposób** dowiadywania się o błędzie — nie parsuje statusów ręcznie.
- `useProfile()` staje się async: ładowanie profilu po zamontowaniu, plus stany `loading` i `error`. `App.vue` obsługuje **stan ładowania** (np. szkielet/spinner) oraz **stan błędu** (komunikat o nieosiągalnym/niesprawnym backendzie zamiast cichej awarii lub pustego ekranu).
- **Walidacja email na froncie pozostaje** (FR-6) jako pierwsza linia; serwer waliduje powtórnie (FR-12). Gdy mimo to serwer zwróci 400, formularz pokazuje `error` z odpowiedzi i **nie wychodzi z trybu edycji** (nie gubi wpisanych danych).
- **Avatar + „Anuluj" (FR-11):** wybór pliku w formularzu robi tylko **lokalny podgląd** (object URL); faktyczny upload następuje dopiero przy **Zapisz**. Kolejność zapisu: **najpierw `POST avatar`** (jeśli wybrano nowy plik) → odebrany `avatarUrl` wchodzi do stanu → **potem `PUT profile`** (pola tekstowe). Jeśli `POST avatar` zwróci błąd (zły typ/za duży), przerywamy zapis, pokazujemy `error`, **nie wołamy `PUT`** (profil nie zmienia się częściowo). **Anuluj** nic nie wysyła — żaden `POST`/`PUT` nie poszedł → brak osieroconych plików na serwerze. Lokalny object URL zwalniamy (`revokeObjectURL`).
- Po udanym uploadzie front używa `avatarUrl` **z cache-bustingiem** zwróconego przez serwer (sekcja 3.3), więc podgląd po zapisie pokazuje nowe zdjęcie, nie zcache'owane stare.

## 5. Strategia testów

- **Backend unit:** schema Zod `ProfileInputSchema` (pusty email = OK, niepusty zły = błąd, odcinanie `avatarUrl` i nieznanych pól, poprawne body przechodzi); `profileStore` (zapis/odczyt, brak pliku → pusty profil, usunięcie, **atomowy zapis temp+rename**, **`PUT` zachowuje istniejący `avatarUrl`**, **podmiana avatara usuwa poprzedni plik o innym rozszerzeniu**).
- **Backend integracyjne (supertest + Vitest):** `GET` pusty profil; `PUT` poprawny / zły email (400) / **whitelist pól** (nieznane pola i `avatarUrl` w body ignorowane); `POST` avatar (obraz → 200 + `avatarUrl` z cache-bustingiem / nie-obraz → 400 / przekroczony rozmiar → **413**); `GET avatar` (po uploadzie → 200 + poprawny `Content-Type`; **bez pliku → 404**); `DELETE` resetuje i jest **idempotentny** (drugie wywołanie też 204); **format błędu** `{ error }` dla 400/404/413; test kontraktowy kształtu `Profile`. Każdy test na **tymczasowym katalogu danych** (`PROFILE_DATA_DIR`), bez dotykania realnych danych.
- **Frontend unit:** `profileService` z mockiem `fetch` — w tym **ścieżka błędu** (response `!ok` → rzuca z `error` z body; błąd sieci → rzuca); `useProfile` async (stany `loading` / `error`).
- **Full-stack E2E (Playwright):** `webServer` startuje **backend (temp `PROFILE_DATA_DIR`) + frontend preview**; `beforeEach` woła `DELETE /api/profile` przez request fixture. Scenariusze: edycja+zapis utrwala po reloadzie (przez backend), zły email blokuje zapis (komunikat z serwera, dane nie giną), upload zdjęcia → podgląd i trwałość po reloadzie, **„Anuluj" po wybraniu zdjęcia nie utrwala nic** (po reloadzie brak zdjęcia), pusty profil na czystym stanie (FR-9).

Mapowanie FR → test pozostaje regułą (sekcja 6 requirements): każde FR ma ≥ 1 test.

| FR | Pokrycie testem |
|---|---|
| FR-8 (trwałość przez backend) | integ. `PUT`+`GET`; E2E zapis+reload |
| FR-9 (pierwsze uruchomienie = pusto) | integ. `GET` pusty profil; E2E czysty stan |
| FR-10 (upload + serwowanie zdjęcia) | integ. `POST`/`GET avatar`; E2E upload + reload |
| FR-11 („Anuluj" bez utrwalania, brak sierot) | E2E „Anuluj"; unit podmiana avatara usuwa poprzedni plik |
| FR-12 (walidacja email na serwerze) | integ. `PUT` zły email → 400; unit `isValidEmail` |
| FR-13 (usunięcie profilu) | integ. `DELETE` reset + idempotencja; E2E `beforeEach` |

## 6. CI/CD

Trzy joby w `.github/workflows/ci.yml`:

1. **frontend** — install (cache `frontend/package-lock.json`), lint, format check, type-check (`vue-tsc`), unit + coverage, build (`vite build`) → publikuje artefakt **`frontend-dist`** (`frontend/dist/`).
2. **backend** — install (cache `backend/package-lock.json`), lint, format check, type-check (`tsc --noEmit`), unit + integration **+ coverage**, build (`tsc`) → publikuje artefakt **`backend-dist`** = `backend/dist/` + `package.json` + `package-lock.json` (lekki; zależności produkcyjne instalowane przy deployu). Coverage backendu mierzony od początku — spójnie z frontendem i sekcją 6 requirements („pokrycie mierzone od początku"); próg (gate) wprowadzimy stopniowo.
3. **e2e** — `needs: [frontend, backend]`; buduje oba, startuje backend (temp `PROFILE_DATA_DIR`) + frontend preview, **czeka aż `GET /api/health` odpowie 200** (wait-on) przed startem testów, odpala full-stack Playwright → publikuje `playwright-report`. Brak osobnej instalacji zależności E2E ponad to, co buduje front/back — Playwright instaluje tylko Chromium (`--with-deps chromium`), spójnie z Etapem 1.

**Build wielu artefaktów** to świadomy cel edukacyjny Etapu 2: dwa niezależnie budowalne i publikowalne artefakty, nazwane spójnie, gotowe pod konteneryzację (Etap 4) i promocję „build once, deploy many" (Etap 5). Wersjonowanie/promocja artefaktów świadomie odłożone do Etapu 5.

## 7. Konfiguracja, zależności, pozostałe

- **Zależności backend:** `express`, `cors`, `multer`, `zod`. Dev: `typescript`, `tsx` (dev runner), `@types/{express,cors,multer,node}`, `vitest`, `@vitest/coverage-v8`, `supertest`, `@types/supertest`, `eslint`, `prettier`.
- **Skrypty backendu:** `dev` (`tsx watch src/index.ts`), `build` (`tsc`), `start` (`node dist/index.js`), `test`, `test:integration`, `test:coverage`, `lint`, `type-check`.
- **Error-middleware:** centralny handler Express mapujący wyjątki na jednolity `{ error }` (sekcja 3.1): `MulterError` `LIMIT_FILE_SIZE` → 413, błąd `fileFilter` (zły typ) → 400, błąd walidacji → 400. Jeden punkt = spójny kontrakt błędów i łatwy do przetestowania.
- **`.gitignore`:** dodać `backend/data/`, `backend/dist/`.
- **`.env.example`:** `VITE_API_BASE_URL` (front); `PORT`, `PROFILE_DATA_DIR` (back).
- **Root `lint-staged`:** rozszerzyć globy z `frontend/**` na też `backend/**`.
- **ESLint/Prettier:** objąć `backend/` (osobny config spójny z frontowym).
- **README:** uruchomienie backendu, zmienne env, dev full-stack (proxy), opis dwóch artefaktów.

## 8. Zmiany kontraktu danych

`avatarUrl` zmienia znaczenie: Etap 1 = data URL / lokalny blob; **Etap 2 = ścieżka/URL pliku serwowanego przez backend**. Zmiana odnotowana w `requirements.md` sekcja 5.4 (zgodnie z regułą „zmiany kontraktu odnotowujemy w tym dokumencie").

## 9. Definicja ukończenia (Definition of Done) — Etap 2

- [ ] Backend Express+TS z API: `GET/PUT/DELETE /api/profile`, `POST/GET /api/profile/avatar`, `GET /api/health`.
- [ ] Jednolity format błędów `{ error }` (sekcja 3.1); statusy: 400 / 413 (rozmiar) / 404 (brak avatara).
- [ ] Trwałość profilu i zdjęcia w plikach na dysku (atomowy zapis JSON); po ponownym otwarciu wczytuje się ostatni profil (FR-8).
- [ ] Pierwsze uruchomienie = pusty profil, bez zdjęcia (FR-9); `DELETE` idempotentny.
- [ ] Upload i serwowanie zdjęcia jako pliku z poprawnym `Content-Type` (FR-10); podmiana zdjęcia usuwa poprzedni plik i odświeża podgląd (cache-busting); „Anuluj" nie utrwala zmian ani zdjęcia, brak osieroconych plików (FR-11).
- [ ] `PUT` walidowany **schemą Zod** (`ProfileInputSchema`): email (FR-12), whitelist pól (strip), typ `ProfileInput` z `z.infer`; zachowuje istniejący `avatarUrl`.
- [ ] Frontend zintegrowany przez `profileService` (HTTP); komponenty bez zmian strukturalnych; obsłużone stany `loading` i `error` (backend nieosiągalny/niesprawny nie daje cichej awarii).
- [ ] Testy: backend unit + integracyjne (supertest) **+ coverage**, frontend unit (w tym ścieżki błędów), full-stack E2E — zielone lokalnie i w CI; każde FR-8…FR-13 ma ≥ 1 test (tabela w sekcji 5).
- [ ] CI: joby frontend + backend + e2e; coverage backendu mierzony; e2e czeka na `/api/health`; publikacja dwóch artefaktów (`frontend-dist`, `backend-dist`).
- [ ] README i `requirements.md` zaktualizowane (kontrakt 5.4, FR Etap 2, decyzje).

## 10. Poza zakresem (świadomie odłożone)

- Docker / docker-compose (Etap 4).
- CD, wdrożenia dev/staging/prod, promocja i wersjonowanie artefaktów (Etap 5).
- MongoDB, migracje, seedy (Etap 3).
- Uwierzytelnianie, wielu użytkowników, hosting zdjęć na CDN.
- **Świadomie pominięte jako overengineering (brak powodu edukacyjnego teraz):** rate-limiting, wersjonowanie API, biblioteka do file-lock/mutex (aplikacja jednoosobowa — atomowy rename wystarcza), limity długości pól tekstowych, sanityzacja/normalizacja nazw plików ponad ustalenie rozszerzenia z typu MIME, skan antywirusowy uploadu.
