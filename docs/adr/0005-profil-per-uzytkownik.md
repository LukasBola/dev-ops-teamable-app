# ADR-0005: Prywatny profil per użytkownik w osobnej kolekcji `profiles`

- **Status:** Zaakceptowany
- **Retrospektywny:** nie
- **Data decyzji:** 2026-11-22 (źródło: spec Etapu 4.5); wdrożenie 2026-11-22 (`0c80e85`, `f7c667a`)
- **Data spisania:** 2026-11-22
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
- `userUploadsDir` przyjmuje ID pasujące do `[A-Za-z0-9_-]{1,64}`, celowo nie zawężone do formatu ObjectId: blokuje path traversal, a nie wiąże zapisu avatarów z formatem ID adaptera [wniosek].
- E-mail kontaktowy może się różnić od e-maila logowania.

**Niewiadome**

- Brak.

## Dowody

- `backend/src/models/Profile.ts` – `PROFILE_ID = 'profile'`
- `backend/src/services/profileStore.ts` – jeden katalog `uploads/` na serwer
- `docs/superpowers/specs/2026-11-22-etap4-5-auth-design.md` – sekcje 4–5
- `0c80e85` – `profileStore` przyjmuje `userId`, `_id` bez wartości domyślnej, `userUploadsDir`; testy izolacji i SEC-B4/B5
- `f7c667a` – `adoptLegacyProfile` (kolejność zapisów chroni dane przy przerwaniu), `deleteUser` sprząta profil i avatar, profil nowego konta z e-mailem kontaktowym
- `610b1f5` – E2E: AAPI-N8…N10, SEC-5, AUI-P6; kontrprzykład „wspólny profil dla wszystkich” → czerwone dokładnie testy izolacji
- `c42bb52` – przejęcie singletonu z plikiem avatara w kontenerze compose
