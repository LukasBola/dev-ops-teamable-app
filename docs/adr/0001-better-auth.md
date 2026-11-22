# ADR-0001: Better Auth jako warstwa uwierzytelniania, z zamkniętą rejestracją i adapterem MongoDB

- **Status:** Proponowany
- **Data decyzji:** 2026-11-22 (źródło: spec Etapu 4.5)
- **Zastępuje / Zastąpiony przez:** —

## Kontekst

API profilu nie ma kontroli dostępu, a aplikacja docelowo będzie publiczna i wieloużytkownikowa (właściciel + inni użytkownicy). Baza to MongoDB (Mongoose, standalone `mongo:7`), backend Express 5. W projekcie helpdesk Better Auth sprawdził się jako zamiennik własnej implementacji sesji i haseł (helpdesk ADR-0006).

## Decyzja

Better Auth, tylko e-mail + hasło, `disableSignUp: true`. Konta tworzy, usuwa i resetuje im hasło właściciel przez CLI (`createCredentialUser` z hasherem Better Auth). Adapter `mongodbAdapter(mongoose.connection.db)` bez `client`, czyli bez transakcji. Bez `cookieCache`. Bez ról i `isBlocked` do czasu panelu admina; wtedy wzorzec helpdesk: `additionalFields` z `input: false` + blokada w `databaseHooks.session.create.before`.

## Rozważane opcje

- Otwarta rejestracja: odrzucona, bo wymaga weryfikacji e-mail, resetu hasła mailem (dostawca maili), rate limitów i ochrony przed spamem; podwaja etap.
- Adapter z `client` (transakcje): wymaga replica setu; odrzucony, by nie zmieniać topologii Mongo w compose i Etapie 5.
- Własna implementacja (express-session + bcrypt): odrzucona; więcej kodu do utrzymania (lekcja helpdesk).

## Konsekwencje

**Pozytywne**

- Brak publicznego sign-up (`disableSignUp` blokuje też `auth.api.signUpEmail`).
- Hashowanie, sesje i rate limiting po stronie biblioteki.

**Negatywne / koszty**

- Tworzenie `user` + `account` nieatomowe; CLI musi sprzątać częściowy stan.
- Reset hasła tylko przez właściciela (CLI).
- Nowy sekret `BETTER_AUTH_SECRET` per środowisko.

**Niewiadome**

- Indeksy tworzone przez adapter Mongo (np. unikalny `user.email`) — do weryfikacji przy wdrożeniu.

## Dowody

- `docs/superpowers/specs/2026-11-22-etap4-5-auth-design.md` – sekcje 2, 3, 6
- docs Better Auth (Context7, 2026-11-22) – adapter Mongo: `client` włącza transakcje; Express 5: `/api/auth/*splat`
- helpdesk `docs/adr/0006-better-auth.md` – wzorzec i lekcje (`disableSignUp`, `databaseHooks`, `cookieCache`)
