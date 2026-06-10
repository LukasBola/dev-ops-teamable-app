# Teamable

Projekt edukacyjny do nauki DevOps. Etap 1: frontend profilu użytkownika
(Vue 3 + TypeScript + Tailwind) z testami i CI. Szczegóły: `requirements.md`
oraz `docs/superpowers/`.

## Struktura

- `frontend/` — aplikacja Vue 3 (Vite).
- `.github/workflows/ci.yml` — pipeline CI (GitHub Actions).
- `docs/superpowers/` — spec i plan implementacji.

## Uruchomienie lokalne

```bash
cd frontend
npm install
npm run dev        # serwer deweloperski
```

## Testy

```bash
cd frontend
npm run test:unit -- --run   # testy jednostkowe/komponentowe
npm run test:e2e             # testy E2E (Playwright)
npm run type-check           # sprawdzenie typów
npm run lint                 # ESLint
```

## Konwencje

- Conventional Commits (wymuszane przez commitlint + Husky).
- Gałęzie: GitHub Flow (krótkie gałęzie + PR do `main`).
