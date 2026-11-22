# Architecture Decision Records

Każdy plik opisuje jedną decyzję architektoniczną: kontekst, decyzję, rozważane opcje, konsekwencje i dowody.

**ADR-y prowadzimy od Etapu 4.5.** Wcześniejsze decyzje (1–43) są zapisane w tabeli w [`requirements.md`](../../requirements.md) (sekcja 8.1) i nie są przepisywane wstecz. Nowe decyzje architektoniczne trafiają tutaj, a `requirements.md` linkuje do ADR-a.

Nowy ADR: skopiuj [`0000-template.md`](0000-template.md), nadaj kolejny numer. Zmiana decyzji to nowy ADR; stary dostaje status „Zastąpiony przez”.

| ADR | Decyzja | Status |
|---|---|---|
| [0001](0001-better-auth.md) | Better Auth: e-mail + hasło, zamknięta rejestracja, adapter MongoDB | Proponowany |
| [0002](0002-jeden-origin-spa-api.md) | SPA i API pod jednym originem, bez CORS | Proponowany |
| [0003](0003-ochrona-csrf-origin.md) | Ochrona CSRF przez sprawdzanie `Origin` dla mutacji `/api` | Proponowany |
| [0004](0004-walidacja-env-zod.md) | Walidacja zmiennych środowiskowych przez Zod przy starcie | Proponowany |
| [0005](0005-profil-per-uzytkownik.md) | Prywatny profil per użytkownik w osobnej kolekcji `profiles` | Proponowany |
