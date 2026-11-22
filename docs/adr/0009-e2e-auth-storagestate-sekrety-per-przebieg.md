# ADR-0009: E2E uwierzytelniania — projekt `setup` ze `storageState`, sekrety generowane na przebieg, kontrprzykłady jako dowód testów negatywnych

- **Status:** Zaakceptowany
- **Retrospektywny:** nie
- **Data decyzji:** 2026-11-22 (źródło: plan Etapu 4.5, Task 7, i jego wykonanie); wdrożenie 2026-11-22 (`610b1f5`)
- **Data spisania:** 2026-11-22
- **Zastępuje / Zastąpiony przez:** —

## Kontekst

Po Etapie 4.5 każde żądanie do API profilu wymaga sesji, więc ok. 50 nowych i istniejących testów E2E musi się logować. Testy dzielą jeden backend i bazę (`workers: 1`). Wylogowanie lub zmiana hasła kasują sesję w bazie. CI nie ma sekretów repozytorium dla E2E. Test negatywny, który przechodzi także bez zabezpieczenia, niczego nie sprawdza.

## Decyzja

Projekt Playwright `setup` (zależność projektu `chromium`) loguje konto A raz i zapisuje `e2e/.auth/user-a.json`; pozostałe testy startują z tą sesją. Testy wylogowania, zmiany hasła i usuwania konta działają na własnych sesjach lub kontach (`uniqueEmail`). Orkiestrator generuje `BETTER_AUTH_SECRET` i hasło kont A/B na każdy przebieg i zakłada konta przez CLI. Testy negatywne dowodzimy kontrprzykładami: celowo psujemy zabezpieczenie, oczekujemy czerwieni dokładnie testów, które go pilnują, i przywracamy kod z gita.

## Rozważane opcje

- `globalSetup`: odrzucone — kolejność względem `webServer` wymagałaby potwierdzenia w dokumentacji; projekt `setup` działa niezależnie od niej.
- Logowanie w każdym teście: odrzucone — wolniej, a nie sprawdza więcej niż AUI/AAPI.
- Sekrety E2E w repozytorium GitHub: odrzucone — niepotrzebne, skoro baza i konta żyją tylko w przebiegu.
- Kontrprzykład „usunięty `requireAuth`”: odrzucony po próbie — 69/73 czerwone, bo router bez użytkownika zwraca 500 także w resetach; zastąpiony „brakiem 401”.

## Konsekwencje

**Pozytywne**

- 74 testy, około minuty, dwa przebiegi z rzędu zielone; CI bez nowych sekretów.
- Każdy z FR-14…FR-19 ma test pozytywny i negatywny; kontrprzykłady (brak 401, wspólny profil, brak `originCheck`) czerwienią wyłącznie testy, które powinny.

**Negatywne / koszty**

- Reguła do pamiętania: żaden test nie może wylogować sesji ze `storageState`.
- Testy „bez sesji” resetują profil A osobnym kontekstem (`resetProfileA`).
- Limit prób logowania nie jest testowany w E2E (backend w trybie dev); sprawdzany ręcznie na compose.

**Niewiadome**

- Brak.

## Dowody

- `610b1f5` – `frontend/e2e/auth.setup.ts`, `helpers.ts`, `playwright.config.ts` (projekt `setup`), `backend/scripts/e2e-mongo.ts` (sekrety, konta, wspólny `PROFILE_DATA_DIR`), zestawy AUI/AAPI/SEC/ACC/DIRECT
- docs/superpowers/plans/2026-11-22-etap4-5-auth.md – Task 7, tabela kontrprzykładów
- `c42bb52` – ręczna weryfikacja limitu prób (429) na compose
