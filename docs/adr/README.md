# Architecture Decision Records

Każdy plik opisuje jedną decyzję architektoniczną: kontekst, decyzję, rozważane opcje, konsekwencje i dowody (commity, pliki).

**ADR-y prowadzimy od Etapu 4.5.** Wcześniejsze decyzje (1–43) są zapisane w tabeli w [`requirements.md`](../../requirements.md) (sekcja 8.1) i nie są przepisywane wstecz. Nowe decyzje architektoniczne trafiają tutaj, a tabela w `requirements.md` linkuje do ADR-a. Wzór ([`0000-template.md`](0000-template.md)) pochodzi z projektu helpdesk.

## Kiedy pisać ADR

Piszemy ADR, gdy decyzja spełnia **co najmniej jeden** warunek:

- trudno ją odwrócić albo dotyka wielu miejsc (baza, auth, granica frontend/API, format danych, kontrakt);
- wybieramy między realnymi opcjami i powód nie wynika z samego kodu;
- wprowadza ograniczenie, o którym łatwo zapomnieć, a którego złamanie psuje coś po cichu (np. przypięta wersja zależności, kolejność middleware, nazwy indeksów);
- zmienia albo zastępuje wcześniejszą decyzję (z `requirements.md` 8.1 lub innego ADR-a).

**Nie** piszemy ADR dla: łatwo odwracalnego wyboru biblioteki bez wpływu na resztę, szczegółów implementacji widocznych w kodzie, poprawek błędów, kroków procesu (kolejność commitów, sposób weryfikacji). Takie rzeczy trafiają do planu, opisu PR albo komentarza w kodzie.

## Jak

1. Skopiuj [`0000-template.md`](0000-template.md), nadaj kolejny numer (numerów nie używamy ponownie).
2. Decyzja podjęta, niewdrożona → **Proponowany**. Po wdrożeniu → **Zaakceptowany** i commity w „Dowodach”.
3. Każde twierdzenie ma dowód albo dopisek `[wniosek]`. Maks. ~1 strona.
4. Zmiana decyzji to nowy ADR; stary dostaje status „Zastąpiony przez”. W zaakceptowanym ADR-ze wolno tylko dopisać dowody i rozstrzygnięcie niewiadomej (z datą).
5. Dopisz wiersz do tabeli poniżej i do `requirements.md` 8.1.

| ADR | Decyzja | Status |
|---|---|---|
| [0001](0001-better-auth.md) | Better Auth: e-mail + hasło, zamknięta rejestracja, adapter MongoDB | Zaakceptowany |
| [0002](0002-jeden-origin-spa-api.md) | SPA i API pod jednym originem, bez CORS | Zaakceptowany |
| [0003](0003-ochrona-csrf-origin.md) | Ochrona CSRF przez sprawdzanie `Origin` dla mutacji `/api` | Zaakceptowany |
| [0004](0004-walidacja-env-zod.md) | Walidacja zmiennych środowiskowych przez Zod przy starcie | Zaakceptowany |
| [0005](0005-profil-per-uzytkownik.md) | Prywatny profil per użytkownik w osobnej kolekcji `profiles` | Zaakceptowany |
| [0006](0006-indeksy-auth-w-migracji.md) | Indeksy kolekcji auth w migracji; duplikaty blokują start | Zaakceptowany |
| [0007](0007-jeden-sterownik-mongodb.md) | Jedna wersja sterownika `mongodb` (wersja z mongoose) | Zaakceptowany |
| [0008](0008-ui-identyfikator-tokeny-fonty.md) | UI „Identyfikator”: tokeny w `@theme`, fonty lokalnie | Zaakceptowany |
| [0009](0009-e2e-auth-storagestate-sekrety-per-przebieg.md) | E2E auth: projekt `setup`, sekrety na przebieg, kontrprzykłady | Zaakceptowany |
| [0010](0010-przekazanie-projektu-ui-tokeny-dtcg.md) | Przekazanie projektu UI: tokeny DTCG, makieta, zrzuty | Zaakceptowany |
| [0011](0011-graf-wiedzy-graphify.md) | Graf wiedzy Graphify: commitowany `graph.json`, aktualizacja w pre-commit, strict dla agenta | Zaakceptowany |
| [0014](0014-runtime-node-24.md) | Node.js 24 LTS jako runtime w CI, obrazach Docker i typach | Proponowany |

Bez osobnych ADR-ów (świadomie): `ENV NODE_ENV=production` w obrazie (konsekwencja ADR-0001, opisana tam), wzorzec `userUploadsDir` (część ADR-0005), wybór skilli do projektowania UI (proces, nie architektura).
