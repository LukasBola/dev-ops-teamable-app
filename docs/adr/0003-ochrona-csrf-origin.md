# ADR-0003: Ochrona CSRF przez sprawdzanie nagłówka `Origin` dla wszystkich mutacji `/api`

- **Status:** Proponowany
- **Data decyzji:** 2026-11-22 (źródło: spec Etapu 4.5)
- **Zastępuje / Zastąpiony przez:** —

## Kontekst

Better Auth sprawdza origin tylko dla własnych endpointów `/api/auth/*`. Mutacje profilu (`PUT`/`DELETE /api/profile`, `POST /api/profile/avatar`) z obcej strony chroniłby wyłącznie `SameSite=Lax` ciasteczka. W helpdesku ta luka wyszła dopiero w testach E2E.

## Decyzja

Middleware `originCheck` na `/api`, montowany po handlerze Better Auth: dla metod innych niż GET/HEAD/OPTIONS żądanie z nagłówkiem `Origin` różnym od originu `BETTER_AUTH_URL` dostaje 403. Żądania bez `Origin` przechodzą.

## Rozważane opcje

- Tokeny CSRF (double submit): odrzucone — więcej kodu po obu stronach, a przy jednym originie i `SameSite=Lax` sprawdzenie `Origin` daje porównywalną ochronę.
- Tylko `SameSite=Lax`: odrzucone — brak obrony w głąb.

## Konsekwencje

**Pozytywne**

- Jedna lista zaufanych originów dla Better Auth i reszty API.

**Negatywne / koszty**

- Żądania bez `Origin` nie są sprawdzane; ochronę daje wtedy brak ciasteczka / `SameSite`.

**Niewiadome**

- Brak.

## Dowody

- `docs/superpowers/specs/2026-11-22-etap4-5-auth-design.md` – sekcja 6.4
- helpdesk `docs/adr/0008-ochrona-csrf-origin.md` – wzorzec i pochodzenie luki
