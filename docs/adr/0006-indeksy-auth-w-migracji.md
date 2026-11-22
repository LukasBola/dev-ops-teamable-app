# ADR-0006: Indeksy kolekcji Better Auth zakładane migracją przed startem; duplikaty blokują start

- **Status:** Zaakceptowany
- **Retrospektywny:** nie
- **Data decyzji:** 2026-11-22 (źródło: sesja wdrożenia Etapu 4.5, Task 2); wdrożenie 2026-11-22 (`17ebe1e`)
- **Data spisania:** 2026-11-22
- **Zastępuje / Zastąpiony przez:** —

## Kontekst

Unikalność e-maila konta chroni dziś dwie rzeczy: sprawdzenie „czy istnieje” w `createCredentialUser` i indeks w bazie. Adapter MongoDB w better-auth 1.7.27 zakłada indeksy sam, ale leniwie (przy pierwszej operacji) i przy błędzie tylko loguje; przy duplikatach w bazie unikalny indeks po cichu nie powstaje. Bez indeksu dwa równoległe `createCredentialUser` z tym samym e-mailem tworzą dwa konta.

## Decyzja

Migracja `20261122120000-auth-indexes.cjs` zakłada `user_email_uidx`, `session_token_uidx`, `session_userId_idx` i `account_userId_idx` — z nazwami i opcjami identycznymi jak w adapterze. Migracje działają przed startem aplikacji (entrypoint z `set -e`, `make dev`, orkiestrator E2E), więc duplikat przerywa start z komunikatem wskazującym indeks i powtórzoną wartość.

## Rozważane opcje

- Polegać tylko na adapterze: odrzucone — błąd znika w logach, unikalność nie działa.
- Indeks z collation niewrażliwą na wielkość liter: odrzucony — inne opcje niż w adapterze, więc adapter zgłaszałby konflikt przy każdym starcie [wniosek]; wielkość liter normalizuje `createCredentialUser`.
- Własne nazwy indeksów: odrzucone — Mongo nie pozwala na dwa indeksy o tym samym kluczu i opcjach pod różnymi nazwami, więc migracja i adapter by się gryzły.

## Konsekwencje

**Pozytywne**

- Wyścig przy zakładaniu konta kończy się jednym kontem (test pada bez indeksu).
- Problem z danymi zatrzymuje start głośno, zamiast ukrywać się w logach.

**Negatywne / koszty**

- Nazwy indeksów są skopiowane z wersji adaptera; aktualizacja `better-auth` musi przejść test zgodności.
- Indeks rozróżnia wielkość liter; zapis do kolekcji `user` z pominięciem Better Auth i `createCredentialUser` mógłby utworzyć `Anna@` obok `anna@`.

**Niewiadome**

- Brak.

## Dowody

- `17ebe1e` – migracja i `migration-auth-indexes.spec.ts`: indeksy, idempotencja obok indeksów adaptera, odrzucenie duplikatu przez bazę, równoległe tworzenie konta, przerwanie przy duplikatach, `down`
- `node_modules/@better-auth/mongo-adapter/dist/index.mjs` (1.7.27) – `ensureFieldIndex`: tworzenie w tle, błąd `DUPLICATE_KEY` tylko logowany
- `f7c667a` – testy wielkości liter (CLI, seed) i kontrola statyczna braku zapisów do `user` poza Better Auth
- `c42bb52` – compose: `Exited (1)` z „Nie można założyć unikalnego indeksu user_email_uidx … dup key”, po usunięciu duplikatów `healthy`
