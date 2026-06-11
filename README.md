# Teamable

Projekt edukacyjny do nauki DevOps. Etap 1: frontend profilu użytkownika
(Vue 3 + TypeScript + Tailwind). Etap 2: backend Express 5 + TypeScript + REST API.
Szczegóły: `requirements.md` oraz `docs/superpowers/`.

## Struktura

- `frontend/` — aplikacja Vue 3 (Vite).
- `backend/` — serwer Express 5 (Node.js + TypeScript ESM).
- `.github/workflows/ci.yml` — pipeline CI (GitHub Actions).
- `docs/superpowers/` — spec i plan implementacji.

## Uruchomienie lokalne (full-stack)

| Krok | Komenda |
|------|---------|
| Backend (dev, port 3001) | `cd backend && npm install && npm run dev` |
| Frontend (dev, port 5173, proxy /api → 3001) | `cd frontend && npm install && npm run dev` |

Zmienne środowiskowe: patrz `backend/.env.example` (`PORT`, `PROFILE_DATA_DIR`)
i `frontend/.env.example` (`VITE_API_BASE_URL`; puste = same-origin przez proxy).

Dane backendu trafiają do `backend/data/` (gitignored): `profile.json` + `uploads/`.

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

## Artefakty CI

Pipeline buduje i publikuje dwa niezależne artefakty: `frontend-dist` (statyczny build Vite)
i `backend-dist` (skompilowany `dist/` + pliki `package*` — zależności produkcyjne instalowane
przy wdrożeniu). Job `e2e` uruchamia testy Playwright przeciwko prawdziwemu backendowi.

## Konwencje

- Conventional Commits (wymuszane przez commitlint + Husky).
- Gałęzie: GitHub Flow (krótkie gałęzie + PR do `main`).
