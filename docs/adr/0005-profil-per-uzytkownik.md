# ADR-0005: Prywatny profil per użytkownik w osobnej kolekcji `profiles`

- **Status:** Proponowany
- **Data decyzji:** 2026-11-22 (źródło: spec Etapu 4.5)
- **Zastępuje / Zastąpiony przez:** — (zmienia decyzję 17 z `requirements.md`: singleton `_id:'profile'`)

## Kontekst

Profil to dziś jeden dokument `profiles { _id: 'profile' }` i jeden plik `uploads/avatar.<ext>` na cały serwer. Po dodaniu auth każdy użytkownik ma mieć własny, prywatny profil (widzi i edytuje tylko swój). Endpointy `/api/profile`, kontrakt `Profile`, walidacja Zod i testy są sprawdzone w Etapach 2–3.

## Decyzja

Kolekcja `profiles` z `_id = user.id` z Better Auth; Better Auth trzyma tylko konto i sesję. Avatar w `uploads/<userId>/`. Endpointy i kontrakt `Profile` bez zmian — użytkownika wyznacza sesja. E-mail w profilu to e-mail kontaktowy (przy utworzeniu konta = e-mail logowania). Istniejący singleton przejmuje pierwsze konto utworzone przez CLI.

## Rozważane opcje

- Pola profilu jako `user.additionalFields` Better Auth: odrzucone — wyrzuca endpointy, Zod i kontrakt; walidacja w hookach Better Auth; avatar i tak wymaga własnego endpointu.
- Profil zagnieżdżony w dokumencie usera: wady powyższego bez przewagi.

## Konsekwencje

**Pozytywne**

- Minimalna zmiana API i frontendu; testy profilu zostają.
- Granica: Better Auth = tożsamość, `profiles` = dane aplikacji.

**Negatywne / koszty**

- Dane użytkownika w dwóch miejscach; usunięcie konta musi sprzątać profil i avatar.
- E-mail kontaktowy może się różnić od e-maila logowania.

**Niewiadome**

- Brak.

## Dowody

- `backend/src/models/Profile.ts` – `PROFILE_ID = 'profile'`
- `backend/src/services/profileStore.ts` – jeden katalog `uploads/` na serwer
- `docs/superpowers/specs/2026-11-22-etap4-5-auth-design.md` – sekcje 4–5
