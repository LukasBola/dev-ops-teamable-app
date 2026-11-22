# ADR-0007: Jedna wersja sterownika `mongodb` w backendzie, przypięta do wersji z mongoose

- **Status:** Zaakceptowany
- **Retrospektywny:** nie
- **Data decyzji:** 2026-11-22 (źródło: sesja wdrożenia Etapu 4.5, Task 2); wdrożenie 2026-11-22 (`f600d3d`)
- **Data spisania:** 2026-11-22
- **Zastępuje / Zastąpiony przez:** —

## Kontekst

Adapter Better Auth dostaje `mongoose.connection.db`, czyli obiekt sterownika z kopii `mongodb` należącej do mongoose. Mongoose 9.7 wymaga `mongodb ~7.2`, a `better-auth` i `migrate-mongo` deklarują `mongodb` jako peer z szerszym zakresem, więc npm zainstalował obok 7.3.0. TypeScript uznał typy z dwóch kopii za niezgodne i `type-check` przestał przechodzić.

## Decyzja

`mongodb` jest jawną zależnością backendu w zakresie zgodnym z mongoose (`~7.2.0`), żeby npm zostawił jedną kopię dla mongoose, adaptera i migracji. Przy aktualizacji mongoose lub `better-auth` sprawdzamy `npm ls mongodb`: jedna wersja, reszta `deduped`.

## Rozważane opcje

- `overrides` w `package.json`: odrzucone — wymusza wersję także tam, gdzie zakres by się nie zgadzał, i jest mniej widoczne niż zwykła zależność [wniosek].
- Rzutowanie typu (`as unknown as Db`): odrzucone — ukrywa dwie kopie sterownika w działającym procesie zamiast je usunąć.

## Konsekwencje

**Pozytywne**

- Jedna kopia sterownika w procesie; `type-check` przechodzi bez rzutowań.

**Negatywne / koszty**

- Ręczna synchronizacja: podbicie mongoose do `mongodb ~7.3` bez podbicia tej zależności przywróci duplikat.

**Niewiadome**

- Brak.

## Dowody

- `f600d3d` – `backend/package.json`: `"mongodb": "~7.2.0"`; `npm ls mongodb` → 7.2.0, wszystkie `deduped`
- `npm view mongoose@9.7.0 dependencies.mongodb` → `~7.2`; `npm view @better-auth/mongo-adapter@1.7.27 peerDependencies` → `mongodb ^6.0.0 || ^7.0.0`
- docs/superpowers/plans/2026-11-22-etap4-5-auth.md – Task 2, „Rozstrzygnięte”
