# ADR-0004: Walidacja zmiennych środowiskowych przez Zod przy starcie backendu

- **Status:** Proponowany
- **Data decyzji:** 2026-11-22 (źródło: spec Etapu 4.5)
- **Zastępuje / Zastąpiony przez:** —

## Kontekst

Backend czyta `process.env` w kilku miejscach (`index.ts`, `db/connection.ts`, `profileStore.ts`) bez walidacji. Etap 4.5 dodaje sekret `BETTER_AUTH_SECRET` i `BETTER_AUTH_URL`, a Etap 5 będzie wstrzykiwał konfigurację per środowisko. Brak lub błąd sekretu nie może się ujawnić dopiero przy pierwszym logowaniu.

## Decyzja

Jeden schemat Zod w `backend/src/env.ts` waliduje `process.env` przy starcie; przy błędzie backend się nie uruchamia. Reszta kodu czyta konfigurację wyłącznie z obiektu `env`. `BETTER_AUTH_SECRET` (min. 32 znaki) nie ma wartości domyślnej.

## Rozważane opcje

- Odczyt `process.env` w miejscu użycia (stan obecny): odrzucony — błędy konfiguracji wychodzą późno.
- Osobna biblioteka (np. envalid): odrzucona — Zod jest już zależnością backendu.

## Konsekwencje

**Pozytywne**

- Błędna konfiguracja zatrzymuje start z czytelnym komunikatem (ważne przy deployu Etapu 5).
- Typowany dostęp do konfiguracji.

**Negatywne / koszty**

- Testy muszą ustawiać kompletne env (setup Vitest, orkiestrator E2E).

**Niewiadome**

- Brak.

## Dowody

- `backend/src/index.ts`, `backend/src/db/connection.ts`, `backend/src/services/profileStore.ts` – rozproszony odczyt `process.env`
- `backend/package.json` – `zod` już w zależnościach
- helpdesk `docs/adr/0009-walidacja-env-zod.md` – wzorzec
