# ADR-0002: SPA i API pod jednym originem, bez CORS

- **Status:** Proponowany
- **Data decyzji:** 2026-11-22 (źródło: spec Etapu 4.5)
- **Zastępuje / Zastąpiony przez:** —

## Kontekst

Sesja Better Auth jest w ciasteczku. Frontend już dziś rozmawia z API przez ten sam origin: proxy Vite (`/api` → backend) w dev/preview i nginx (`location /api/`) w obrazie produkcyjnym. Mimo to backend ma `app.use(cors())`, które przepuszcza każdy origin, a frontend obsługuje `VITE_API_BASE_URL` (cross-origin).

## Decyzja

Przeglądarka rozmawia z API wyłącznie przez origin frontendu. Usuwamy `cors()` (i zależność `cors`) oraz `VITE_API_BASE_URL`; klient auth i `profileService` nie mają `baseURL`. `BETTER_AUTH_URL` = publiczny origin aplikacji, któremu Better Auth ufa domyślnie (bez osobnego `CLIENT_URL`).

## Rozważane opcje

- Cross-origin (CORS z allowlistą + `credentials`, `SameSite=None; Secure`): odrzucony — więcej konfiguracji i ryzyka, bez potrzeby, skoro nginx już proxuje `/api`.

## Konsekwencje

**Pozytywne**

- Ciasteczka `SameSite=Lax` działają bez CORS; mniej powierzchni ataku.
- E2E przez `vite preview` sprawdzają to samo połączenie co przeglądarka.

**Negatywne / koszty**

- Wpisanie adresu backendu wprost w kliencie (np. `localhost:3001`) psuje ciasteczka.
- Rozdzielenie frontendu i API na różne domeny wymagałoby nowego ADR-a.

**Niewiadome**

- Czy przy proxy Vite (dev) wystarczy `BETTER_AUTH_URL` = origin dev serwera — do weryfikacji przy wdrożeniu.

## Dowody

- `backend/src/app.ts` – `app.use(cors())`
- `frontend/vite.config.ts` – proxy `/api` w `server` i `preview`
- `frontend/nginx.conf` – `location /api/ { proxy_pass … }`
- helpdesk `docs/adr/0007-jeden-origin-spa-api.md` – wzorzec
