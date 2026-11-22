# Warstwy backendu: services niezależne od HTTP i auth. Plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Docelowa lokalizacja w repo:** `docs/superpowers/plans/2026-11-22-backend-warstwy.md` (zapis w Task 0).

**Sposób wykonania:** Native (superpowers:executing-plans, jak przy planie Graphify): zadania po kolei w tej sesji, TDD (test RED przed kodem), na końcu jeden przegląd całej gałęzi; bez worktree i bez workspace `.superpowers/`.

**Goal:** Usunąć dwa naruszenia warstw w `backend/src` tak, żeby `services/` nie importował niczego z `middleware/` ani z `auth/`, i zabezpieczyć tę regułę testem.

**Architecture:**
1. `services/profileStore.ts` przestaje rzucać `HttpError`. Niepoprawny `userId` to błąd serwera, więc zwykły `Error` daje 500 przez `errorHandler`.
2. Seed konta demo przenosimy z `services/seedProfile.ts` do `auth/demoUser.ts`, bo to zarządzanie kontami, jak `createCredentialUser`. Zależność idzie wtedy w jedną stronę: `auth → services`.
3. Nowy test architektury `__tests__/layers.spec.ts` pilnuje obu reguł.

**Tech Stack:** TypeScript (ESM, importy z `.js`), Express 5, Vitest 4, Testcontainers (MongoDB).

**Spec:** brak osobnego speca. Źródło: analiza grafu Graphify z 2026-11-22 (zależności folderów) i sprawdzenie w kodzie.
- `services/profileStore.ts:8` importował `HttpError` z `middleware/errorHandler.ts`, użyty tylko w `userUploadsDir()`.
- Cykl folderów: `services/seedProfile.ts → auth/users.ts → services/profileStore.ts`.
- `userId` pochodzi z sesji Better Auth (`req.currentUser.id` w `middleware/requireAuth.ts`) albo z bazy, nigdy z body ani URL.

## Global Constraints

- **Gałąź:** zwykła gałąź `refactor/backend-layering` od `main`, bez worktree i bez katalogu `.superpowers/`.
- **Backend:** ESM, `type: module`, importy względne z rozszerzeniem `.js`; testy w `backend/src/__tests__/`, uruchamiane z katalogu `backend/`.
- **Bez zmian zachowania** dla klienta API. Jedyna zmiana: niepoprawny `userId` daje 500 zamiast 400, a ta ścieżka jest nieosiągalna z requestu.
- **Kontrakt błędu `{ error }`** i `errorHandler` bez zmian.
- **Komunikat błędu bez zmian:** `'Niepoprawny identyfikator użytkownika'`.
- **Nazwy:** nowy plik `backend/src/auth/demoUser.ts` eksportuje te same nazwy co `seedProfile.ts`: `seedDemoUser(): Promise<void>` i `DEMO_PROFILE`.
- **Historia bez zmian:** plany i specy Etapów 3 i 4.5 zostają, bo są zapisem przeszłości. Aktualizujemy tylko niewdrożony plan Etapu 5.
- **Bez ADR-a:** zmianę łatwo odwrócić i widać ją w kodzie (reguły z `CLAUDE.md`).

## Review Focus

1. **`make seed` / `npm run seed`:** `backend/scripts/seed.ts` leży poza `tsconfig` (`include: src/**`), więc `tsc` projektu nie wykryje złej ścieżki. → Task 2, Step 6 (osobny `tsc` na `scripts/seed.ts`).
2. **Path traversal w `userUploadsDir`** (`../etc`, `a/b`, `''`) musi nadal rzucać. → istniejący `profileStore.spec.ts` (`it.each`) w pełnym przebiegu, Task 1, Step 5.
3. **Migracja legacy** (`services/legacyProfile.ts` woła `userUploadsDir`) nie może się zepsuć przez zmianę typu błędu. → `legacyProfile.spec.ts` w pełnym przebiegu, Task 1, Step 5.
4. **Test architektury nie może przepuścić importów wieloliniowych ani `import type`.** → regex dopasowuje samo `from '../auth/'`, niezależnie od linii; Task 2, Step 2 musi dać RED na wieloliniowym imporcie w `seedProfile.ts`.
5. **Graf Graphify po zmianie** nie ma krawędzi `services → middleware` ani `services → auth`. → Task 3, Step 2.

---

### Task 0: Cofnięcie wcześniejszych zmian i zapis planu

**Files:**
- Create: `docs/superpowers/plans/2026-11-22-backend-warstwy.md` (ten plan)

- [ ] **Step 1: Cofnij niezacommitowane zmiany na `refactor/backend-layering`**

Gałąź nie ma commitów ponad `main`, więc w drzewie są tylko zmiany z wcześniejszej próby.
Run (z katalogu repo): `git switch refactor/backend-layering && git reset --hard main && git status --short`
Expected: czyste drzewo; `ls backend/src/services/seedProfile.ts` istnieje, a `backend/src/auth/demoUser.ts` nie.

- [ ] **Step 2: Zapisz plan w repo i zacommituj**

```bash
git add docs/superpowers/plans/2026-11-22-backend-warstwy.md
git commit -m "docs(plan): backend layering fix plan"
```

---

### Task 1: `services` niezależne od warstwy HTTP

**Files:**
- Create: `backend/src/__tests__/layers.spec.ts`
- Modify: `backend/src/services/profileStore.ts` (import l. 8; `userUploadsDir`, l. 20–22)
- Test: `backend/src/__tests__/profileStore.spec.ts` (dopisany przypadek)

**Interfaces:**
- Produces: `layers.spec.ts` z pomocniczą funkcją `serviceImports(): Array<[file: string, source: string]>`. Funkcja czyta wszystkie `*.ts` z `src/services` (bez testów); Task 2 dopisze do niej drugi test.
- Produces: `userUploadsDir(userId: string): string`. Sygnatura bez zmian, przy złym id rzuca `Error`, który **nie** jest `HttpError`.

- [ ] **Step 1: Napisz testy, które mają nie przejść**

`backend/src/__tests__/layers.spec.ts`:
```ts
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const servicesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'services')
const serviceImports = (): Array<[string, string]> =>
  readdirSync(servicesDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => [f, readFileSync(path.join(servicesDir, f), 'utf8')])

describe('warstwy backendu: services', () => {
  it.each(serviceImports())('%s nie importuje z middleware (warstwa HTTP)', (_f, src) => {
    expect(src).not.toMatch(/from '\.\.\/middleware\//)
  })
})
```

`profileStore.spec.ts`, w bloku z testami `userUploadsDir`:
```ts
it('userUploadsDir(złe id) rzuca błąd serwera, nie HttpError (userId pochodzi z sesji)', () => {
  expect(() => userUploadsDir('../etc')).toThrow('Niepoprawny identyfikator użytkownika')
  let caught: unknown
  try { userUploadsDir('../etc') } catch (e) { caught = e }
  expect(caught).not.toBeInstanceOf(HttpError)
})
```
Import w teście: `import { HttpError } from '../middleware/errorHandler.js'`.

- [ ] **Step 2: Sprawdź, że testy nie przechodzą**

Run (z `backend/`): `npx vitest run src/__tests__/layers.spec.ts src/__tests__/profileStore.spec.ts`
Expected: FAIL. `profileStore.ts nie importuje z middleware` (match `from '../middleware/`) oraz `rzuca błąd serwera, nie HttpError`.

- [ ] **Step 3: Usuń zależność w `services/profileStore.ts`**

Usuń `import { HttpError } from '../middleware/errorHandler.js'`. W `userUploadsDir` rzuć `new Error('Niepoprawny identyfikator użytkownika')` i dodaj komentarz w jednej linii: userId pochodzi z sesji albo bazy, więc zły format to 500, a nie 400.

- [ ] **Step 4: Sprawdź, że testy przechodzą**

Run: `npx vitest run src/__tests__/layers.spec.ts src/__tests__/profileStore.spec.ts`
Expected: PASS.

- [ ] **Step 5: Pełny backend**

Run: `npx tsc --noEmit && npx eslint src scripts && npx vitest run`
Expected: tsc i eslint bez błędów, wszystkie testy zielone (w tym `legacyProfile.spec.ts`, `api.spec.ts`).

- [ ] **Step 6: Commit**

```bash
git add backend/src/__tests__/layers.spec.ts backend/src/__tests__/profileStore.spec.ts backend/src/services/profileStore.ts
git commit -m "refactor(backend): profileStore no longer depends on HTTP layer"
```

---

### Task 2: Konto demo w `auth/`, bez cyklu `services ↔ auth`

**Files:**
- Move: `backend/src/services/seedProfile.ts` → `backend/src/auth/demoUser.ts`
- Modify: `backend/src/__tests__/layers.spec.ts`, `backend/src/__tests__/seed.spec.ts`, `backend/src/__tests__/cli.spec.ts`, `backend/scripts/seed.ts`, `docs/superpowers/plans/2026-06-17-etap5-wdrozenia.md`

**Interfaces:**
- Consumes: `serviceImports()` z Task 1.
- Produces: `backend/src/auth/demoUser.ts` z `seedDemoUser(): Promise<void>` i `DEMO_PROFILE` (bez zmian w treści). Importuje `./users.js` i `../services/profileStore.js`.

- [ ] **Step 1: Napisz testy, które mają nie przejść**

W `layers.spec.ts`, w tym samym `describe`:
```ts
it.each(serviceImports())('%s nie importuje z auth (konta są warstwą nad profilem)', (_f, src) => {
  expect(src).not.toMatch(/from '\.\.\/auth\//)
})
```
W `seed.spec.ts` i `cli.spec.ts` zmień import `'../services/seedProfile.js'` na `'../auth/demoUser.js'`.

- [ ] **Step 2: Sprawdź, że testy nie przechodzą**

Run: `npx vitest run src/__tests__/layers.spec.ts src/__tests__/seed.spec.ts src/__tests__/cli.spec.ts`
Expected: FAIL. `seedProfile.ts nie importuje z auth` (wieloliniowy import `} from '../auth/users.js'`), a `seed.spec` i `cli.spec` padają przez brak `../auth/demoUser.js`.

- [ ] **Step 3: Przenieś plik**

`git mv backend/src/services/seedProfile.ts backend/src/auth/demoUser.ts`. Zmień w nim importy na `./users.js` i `../services/profileStore.js`. W `backend/scripts/seed.ts` zmień `'../src/services/seedProfile.js'` na `'../src/auth/demoUser.js'`.

- [ ] **Step 4: Sprawdź, że testy przechodzą**

Run: `npx vitest run src/__tests__/layers.spec.ts src/__tests__/seed.spec.ts src/__tests__/cli.spec.ts`
Expected: PASS.

- [ ] **Step 5: Plan Etapu 5 wskazuje nową ścieżkę**

W `docs/superpowers/plans/2026-06-17-etap5-wdrozenia.md` zamień `services/seedProfile` na `auth/demoUser` i `seedProfile.ts` na `demoUser.ts`.
Run: `grep -rn "seedProfile" backend docs/superpowers/plans/2026-06-17-etap5-wdrozenia.md --exclude-dir=node_modules`
Expected: brak wyników.

- [ ] **Step 6: Pełny backend + skrypt seed**

Run (z `backend/`): `npx tsc --noEmit && npx eslint src scripts && npx vitest run && npx tsc --noEmit --ignoreConfig --module nodenext --moduleResolution nodenext --target es2022 --strict --skipLibCheck --types node scripts/seed.ts && echo SEED-OK`
Expected: wszystko zielone i `SEED-OK`.

- [ ] **Step 7: Commit**

```bash
git add -A backend/src/services backend/src/auth backend/src/__tests__ backend/scripts/seed.ts docs/superpowers/plans/2026-06-17-etap5-wdrozenia.md
git commit -m "refactor(backend): move demo account seed to auth, break services↔auth cycle"
```

---

### Task 3: Weryfikacja w grafie i PR

- [ ] **Step 1: Graf przebudowany przez pre-commit**

Run: `git show --stat HEAD | grep graph.json`
Expected: `graphify-out/graph.json` w ostatnim commicie.

- [ ] **Step 2: Brak krawędzi `services → middleware` i `services → auth` w grafie**

Run (z repo): ten sam skrypt zależności folderów, co w analizie (krawędzie `imports`, `imports_from`, `calls` i `uses` między folderami `backend/src/*`), przefiltrowany po `backend/src/services ->`.
Expected: tylko `-> backend/src/models`, `-> backend/src/schemas`, `-> backend/src/types` (bez `auth` i `middleware`).

- [ ] **Step 3: Push i PR**

`git push -u origin refactor/backend-layering`, potem `gh pr create --base main` z opisem obu zmian, testem warstw i wynikami.
Expected: CI zielone.
