# Teamable

Projekt edukacyjny do nauki DevOps. Etap 1: frontend profilu użytkownika
(Vue 3 + TypeScript + Tailwind). Etap 2: backend Express 5 + TypeScript + REST API.
Etap 4.5: logowanie e-mailem i hasłem (Better Auth), prywatny profil każdego użytkownika.
Szczegóły: `requirements.md` oraz `docs/superpowers/`.

## Struktura

- `frontend/` — aplikacja Vue 3 (Vite).
- `backend/` — serwer Express 5 (Node.js + TypeScript ESM).
- `.github/workflows/ci.yml` — pipeline CI (GitHub Actions).
- `docs/superpowers/` — spec i plan implementacji.

## Uruchomienie lokalne (full-stack)

Najprościej — przez `Makefile` w korzeniu repo (wymaga Dockera dla MongoDB):

```bash
make install   # zależności backend + frontend (raz)
make dev       # Mongo + migracje + backend (:3001) i frontend (:5173)
```

`make dev` ogarnia całą sekwencję jedną komendą; Ctrl+C zatrzymuje oba serwery.
`make help` wypisuje wszystkie zadania (`up`, `down`, `migrate`, `seed`, `e2e`, `test`, `clean`).
Przy pierwszym `make up`/`dev` powstają `backend/.env` i `.env` z plików `*.example`,
z wygenerowanym `BETTER_AUTH_SECRET` (istniejących plików `make` nie rusza). Jeśli masz
starszy `backend/.env` bez sekretu, backend odmówi startu z listą brakujących zmiennych —
dopisz `BETTER_AUTH_SECRET=$(openssl rand -base64 32)` albo usuń plik i uruchom `make env`.

Po pierwszym starcie załóż sobie konto (rejestracji w aplikacji nie ma):

```bash
make user ARGS="create --email ty@example.com --password 'min-8-znakow'"
```

Logujesz się na http://localhost:5173. Jeśli w bazie był profil sprzed kont, pierwsze
utworzone konto go przejmuje (CLI wypisze „Przejęto istniejący profil”).

**Trwałość danych:** konta i profile żyją w wolumenie MongoDB (`teamable-mongo-data`), który
przeżywa `make down`/`make up`. `make dev` **nie** seeduje. Konto demo
(`DEMO_USER_EMAIL`/`DEMO_USER_PASSWORD` z `backend/.env`) zakłada `make seed`, a pełny reset
bazy to `make clean` (usuwa wolumen).

Ręcznie, w dwóch terminalach:

| Krok | Komenda |
|------|---------|
| MongoDB (dev) | `cd backend && docker compose up -d` |
| Backend (dev, port 3001) | `cd backend && npm install && npm run dev` |
| Frontend (dev, port 5173, proxy /api → 3001) | `cd frontend && npm install && npm run dev` |

Zmienne środowiskowe: patrz `backend/.env.example` (`PORT`, `PROFILE_DATA_DIR`, `MONGODB_URI`,
`BETTER_AUTH_*`). Frontend nie ma zmiennych: API jest na tym samym originie (proxy Vite / nginx).
Skrypty backendu ładują `backend/.env` automatycznie (Node `--env-file-if-exists`).

Zdjęcie avatara trafia do `backend/data/uploads/` (gitignored); reszta profilu — do MongoDB.

## Testy

| Poziom | Komenda |
|--------|---------|
| Backend unit + integracyjne | `cd backend && npm test` |
| Backend coverage | `cd backend && npm run test:coverage` |
| Frontend unit | `cd frontend && npm run test:unit` |
| Full-stack E2E (Playwright startuje oba serwery) | `cd backend && npm run test:e2e` |

## Backend — MongoDB (Etap 3)

Backend przechowuje profil w MongoDB (zdjęcie nadal jako plik na dysku).

### Lokalna baza (dev)
```bash
cd backend
docker compose up -d                 # MongoDB na localhost:27017 (nazwany wolumen)
export MONGODB_URI=mongodb://localhost:27017
npm run migrate:up                   # zastosuj migracje (import legacy profile.json, jeśli jest)
npm run seed                         # (opcjonalnie) profil demo
npm run dev                          # backend na :3001
```

### Testy
- `npm test` w `backend/` wymaga **działającego Dockera** — testy integracyjne podnoszą realny MongoDB przez Testcontainers.
- `npm run test:e2e` w `backend/` uruchamia pełny full-stack E2E: kontener Mongo + `migrate:up` + Playwright (frontend + backend).

### Migracje
- `npm run migrate:up` / `migrate:down` / `migrate:status` (wymaga `MONGODB_URI`).

## Logowanie i konta (Etap 4.5)

Logowanie e-mailem i hasłem obsługuje Better Auth (sesja w ciasteczku `HttpOnly`,
`SameSite=Lax`). **Publicznej rejestracji nie ma** — konta zakłada, usuwa i resetuje im hasło
właściciel z linii poleceń. Każdy użytkownik widzi i edytuje tylko swój profil.

| Gdzie | Komenda |
|-------|---------|
| dev (Makefile) | `make user ARGS="create --email a@x.pl --password '…'"` |
| dev (npm) | `npm --prefix backend run user -- create --email a@x.pl --password '…'` |
| docker compose | `docker compose exec backend node dist/cli/user.js create --email a@x.pl --password '…'` |

Komendy: `create` (hasło 8–128 znaków), `set-password` (unieważnia wszystkie sesje
użytkownika), `delete` (usuwa konto, sesje, profil i avatar). Kod wyjścia: `0` OK,
`1` błąd operacji, `2` złe użycie.

Zmienne (`backend/.env` w dev, `.env` dla compose):

- `BETTER_AUTH_SECRET` — wymagany, min. 32 znaki, **nigdy w repo** (`openssl rand -base64 32`).
- `BETTER_AUTH_URL` — adres, pod którym przeglądarka widzi aplikację: dev `http://localhost:5173`,
  compose `http://localhost:8080`. Żądania zmieniające dane z innego originu dostają 403.

Warto wiedzieć:

- Limit prób logowania działa w obrazie (`NODE_ENV=production`): po kilku nieudanych
  próbach w ciągu 10 s odpowiedź to 429.
- Przy starcie migracje zakładają unikalny indeks na e-mailu. Jeśli w bazie są duplikaty,
  backend nie wystartuje i wypisze, który indeks i jaka wartość się powtarza.

## Docker (Etap 4)

The whole app runs as a prod-like stack with one command (Docker Desktop must be running):

```bash
make env                       # .env z wygenerowanym BETTER_AUTH_SECRET (raz)
docker compose up --build      # mongo + backend + frontend (nginx)
docker compose exec backend node dist/cli/user.js create --email ty@example.com --password '…'
```

- Open the app at http://localhost:8080 — nginx serves the SPA and reverse-proxies `/api/` to the backend.
- Only the frontend exposes a host port (`8080`); backend (`3000`) and Mongo (`27017`) are reachable only inside the compose network.
- Avatar files persist in the `teamable-uploads` volume; Mongo data in `teamable-mongo-data`. Both survive `docker compose down`.
- The backend container runs DB migrations on startup (`docker-entrypoint.sh`) before the server listens.

Stop and remove containers (keep data):

```bash
docker compose down
```

Wipe everything including volumes:

```bash
docker compose down -v
```

Dev without containerizing the app (hot reload, Mongo only):

```bash
docker compose -f backend/docker-compose.yml up -d   # just Mongo
# then run frontend/backend with npm run dev as usual
```

Images are published to GHCR from CI on `main`: `ghcr.io/<owner>/teamable-backend` and `ghcr.io/<owner>/teamable-frontend`, tagged with the commit SHA and `latest`.

## Artefakty CI

Pipeline buduje i publikuje dwa niezależne artefakty: `frontend-dist` (statyczny build Vite)
i `backend-dist` (skompilowany `dist/` + pliki `package*` — zależności produkcyjne instalowane
przy wdrożeniu). Job `e2e` uruchamia testy Playwright przeciwko prawdziwemu backendowi.

## Konwencje

- Conventional Commits (wymuszane przez commitlint + Husky).
- Gałęzie: GitHub Flow (krótkie gałęzie + PR do `main`).
