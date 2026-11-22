# ADR-0010: Przekazanie projektu UI jako tokeny W3C (DTCG), makieta HTML i zrzuty, zamiast natywnego pliku Figmy

- **Status:** Zaakceptowany
- **Retrospektywny:** nie
- **Data decyzji:** 2026-11-22 (źródło: plan Etapu 4.5, Task 10); wdrożenie 2026-11-22 (`d6a4e49`)
- **Data spisania:** 2026-11-22
- **Zastępuje / Zastąpiony przez:** —

## Kontekst

Właściciel chce móc wrócić do projektu „Identyfikator” (ADR-0008) i przekazać go projektantowi, np. w Figmie. Narzędzia w projekcie nie mają dostępu do Figmy, więc pliku `.fig` nie da się wygenerować. Projekt ma opisywać wdrożony wygląd, a nie pierwszą makietę.

## Decyzja

Po zatwierdzeniu wyglądu powstaje paczka `docs/design/`: `tokens.json` w formacie W3C Design Tokens (wartości z kodu, import do Figmy wtyczką Tokens Studio), makieta HTML zsynchronizowana z aplikacją (import jako warstwy wtyczką html.to.design), zrzuty wszystkich stanów (jasny/ciemny, 1280/375 px) i `README.md` z instrukcją importu.

## Rozważane opcje

- Natywny `.fig`: niedostępny bez integracji z Figmą.
- Same zrzuty ekranu: odrzucone — projektant traci kolory i fonty jako zmienne.

## Konsekwencje

**Pozytywne**

- Tokeny i makieta w repo, wersjonowane razem z kodem; format niezależny od jednego narzędzia.

**Negatywne / koszty**

- Import do Figmy wymaga dwóch wtyczek i ręcznych kroków po stronie projektanta.
- Makietę trzeba aktualizować przy zmianach wyglądu.

**Niewiadome**

- Jakość importu html.to.design dla animacji obrotu i pseudo-elementów smyczy — nie sprawdzona (brak dostępu do Figmy); README wskazuje zrzuty jako wzór, gdy import je spłaszczy.

## Dowody

- docs/superpowers/plans/2026-11-22-etap4-5-auth.md – Task 10
- `21ab488` – pierwsza wersja makiety w `docs/design/teamable-identyfikator.html`
- `d6a4e49` – `docs/design/tokens.json` (DTCG, wartości z `main.css`), makieta zsynchronizowana z aplikacją (stan edycji, `meta charset` do importu z pliku), 20 zrzutów buildu produkcyjnego, `docs/design/README.md` z instrukcją importu
- skrypt zgodności (2026-11-22) – tabela kolorów w README = `tokens.json`; wszystkie ścieżki w README istnieją
