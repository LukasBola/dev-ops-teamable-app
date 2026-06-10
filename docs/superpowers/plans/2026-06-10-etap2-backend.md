# Etap 2 — Backend Express + API profilu — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend Express+TS z trwałością profilu w pliku JSON i zdjęciem jako plikiem, zintegrowany z frontendem przez `profileService`, z full-stack E2E i CI budującym dwa artefakty.

**Architecture:** Monorepo zyskuje samodzielny `backend/` (Express 5 + TypeScript ESM, walidacja Zod, multer dla uploadu, atomowy zapis JSON temp+rename). Frontend zmienia tylko warstwę `profileService` (localStorage → fetch) + async `useProfile`; w dev/preview proxy Vite `/api` → backend. CI: trzy joby (frontend, backend, e2e) publikujące `frontend-dist` i `backend-dist`.

**Tech Stack:** Express 5, TypeScript (nodenext ESM), Zod 4, multer 2, Vitest + supertest, Vue 3, Playwright.

**Spec:** [docs/superpowers/specs/2026-06-10-etap2-backend-design.md](../specs/2026-06-10-etap2-backend-design.md)

**Konwencje obowiązujące w całym planie:**
- Backend jest ESM (`"type": "module"`) z `module: nodenext` — **importy względne w plikach `.ts` mają rozszerzenie `.js`** (np. `import { createApp } from './app.js'`). Vitest i tsx rozumieją to bez konfiguracji.
- Wszystkie komendy backendu uruchamiaj z `backend/`, frontendu z `frontend/`, chyba że napisano inaczej.
- Komunikaty błędów API po polsku, w formacie `{ "error": "..." }`.
- Commity: Conventional Commits (commitlint to wymusza).

---

### Task 0: Gałąź robocza i commit dokumentów

**Files:** brak zmian w kodzie.

- [ ] **Step 1: Utwórz gałąź `feat/etap2-backend` od aktualnego `main`**

```bash
cd /Users/lukaszbola/Documents/techworld/teamable
git checkout main
git pull
git checkout -b feat/etap2-backend
```

- [ ] **Step 2: Zacommituj spec i zaktualizowane requirements**

Uwaga: te pliki są już zmodyfikowane w drzewie roboczym (spec Etapu 2 + requirements v0.3). Jeśli `git status` pokazuje też inne śmieci (np. `frontend/.vite/`), NIE dodawaj ich.

```bash
git add requirements.md docs/superpowers/specs/2026-06-10-etap2-backend-design.md docs/superpowers/plans/2026-06-10-etap2-backend.md
git commit -m "docs: add etap2 backend spec and plan, update requirements to v0.3"
```

---

### Task 1: Szkielet backendu + endpoint `/api/health` (TDD)

**Files:**
- Create: `backend/package.json`, `backend/tsconfig.json`, `backend/tsconfig.build.json`, `backend/vitest.config.ts`, `backend/eslint.config.js`, `backend/.prettierrc.json`, `backend/.env.example`
- Create: `backend/src/app.ts`, `backend/src/index.ts`, `backend/src/__tests__/health.spec.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Utwórz `backend/package.json`**

```json
{
  "name": "backend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "start:e2e": "PROFILE_DATA_DIR=$(mktemp -d) PORT=3001 tsx src/index.ts",
    "build": "tsc -p tsconfig.build.json",
    "type-check": "tsc --noEmit",
    "test": "vitest --run",
    "test:watch": "vitest",
    "test:integration": "vitest --run src/__tests__/api.spec.ts",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint . --fix --cache",
    "format": "prettier --write src/"
  },
  "engines": {
    "node": "^20.19.0 || >=22.12.0"
  }
}
```

- [ ] **Step 2: Zainstaluj zależności**

```bash
cd backend
npm install express cors multer zod
npm install -D typescript tsx @tsconfig/node24 @types/express @types/cors @types/multer @types/node vitest @vitest/coverage-v8 supertest @types/supertest eslint typescript-eslint eslint-config-prettier prettier
```

Oczekiwane: `express@^5`, `multer@^2`, `zod@^4` w `dependencies` (sprawdź w `package.json`; Express 5 automatycznie przekazuje odrzucone promisy z async handlerów do error-middleware — plan na tym polega).

- [ ] **Step 3: Utwórz `backend/tsconfig.json` (type-check, obejmuje testy)**

```json
{
  "extends": "@tsconfig/node24/tsconfig.json",
  "include": ["src/**/*"],
  "compilerOptions": {
    "noEmit": true,
    "types": ["node"]
  }
}
```

- [ ] **Step 4: Utwórz `backend/tsconfig.build.json` (build bez testów)**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["src/__tests__/**"],
  "compilerOptions": {
    "noEmit": false,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

- [ ] **Step 5: Utwórz `backend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 6: Utwórz `backend/eslint.config.js`**

```js
import tseslint from 'typescript-eslint'
import skipFormatting from 'eslint-config-prettier/flat'

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**'] },
  ...tseslint.configs.recommended,
  skipFormatting,
)
```

- [ ] **Step 7: Utwórz `backend/.prettierrc.json` (spójny z frontendem)**

```json
{
  "$schema": "https://json.schemastore.org/prettierrc",
  "semi": false,
  "singleQuote": true,
  "printWidth": 100
}
```

Sprawdź najpierw, czy istnieje `frontend/.prettierrc.json` — jeśli tak, skopiuj jego zawartość zamiast powyższej, żeby style były identyczne:

```bash
ls ../frontend/.prettierrc.json && cat ../frontend/.prettierrc.json
```

- [ ] **Step 8: Utwórz `backend/.env.example`**

```bash
# Port serwera HTTP (domyślnie 3001)
PORT=3001
# Katalog danych: profile.json + uploads/ (domyślnie ./data)
PROFILE_DATA_DIR=
```

- [ ] **Step 9: Dopisz do `.gitignore` (root) katalog danych backendu**

W sekcji `# build output` (po `frontend/dist/`) dodaj linię:

```text
backend/data/
```

(`dist/` i `coverage/` już pokrywają `backend/dist/` i `backend/coverage/` — wzorce bez prefiksu działają na każdym poziomie.)

- [ ] **Step 10: Napisz failing test `backend/src/__tests__/health.spec.ts`**

```ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'

describe('GET /api/health', () => {
  it('zwraca status ok', async () => {
    const res = await request(createApp()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
```

- [ ] **Step 11: Uruchom test — ma FAILować**

Run: `npm test`
Expected: FAIL — `Cannot find module '../app.js'` (lub podobny błąd resolve).

- [ ] **Step 12: Utwórz `backend/src/app.ts` (minimalna implementacja)**

```ts
import express from 'express'
import cors from 'cors'

export function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  return app
}
```

- [ ] **Step 13: Utwórz `backend/src/index.ts`**

```ts
import { createApp } from './app.js'

const port = Number(process.env.PORT ?? 3001)

createApp().listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`)
})
```

- [ ] **Step 14: Testy + type-check + lint — wszystko zielone**

Run: `npm test && npm run type-check && npm run lint`
Expected: 1 test PASS, brak błędów typów, brak błędów lint.

- [ ] **Step 15: Commit**

```bash
cd ..
git add backend .gitignore
git commit -m "feat(backend): scaffold express+ts backend with /api/health"
```

---

### Task 2: Typ `Profile` + schema Zod `ProfileInputSchema` (TDD)

**Files:**
- Create: `backend/src/types/profile.ts`, `backend/src/schemas/profile.ts`
- Test: `backend/src/__tests__/profileSchema.spec.ts`

- [ ] **Step 1: Napisz failing testy `backend/src/__tests__/profileSchema.spec.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { ProfileInputSchema } from '../schemas/profile.js'

const validBody = {
  firstName: 'Anna',
  lastName: 'Nowak',
  email: 'anna@example.com',
  aboutMe: 'Cześć!',
}

describe('ProfileInputSchema', () => {
  it('akceptuje poprawne body', () => {
    const result = ProfileInputSchema.safeParse(validBody)
    expect(result.success).toBe(true)
  })

  it('akceptuje pusty email (spójność z pustym profilem, FR-9)', () => {
    const result = ProfileInputSchema.safeParse({ ...validBody, email: '' })
    expect(result.success).toBe(true)
  })

  it('odrzuca niepusty, niepoprawny email (FR-12)', () => {
    const result = ProfileInputSchema.safeParse({ ...validBody, email: 'zly-email' })
    expect(result.success).toBe(false)
  })

  it('odcina avatarUrl i nieznane pola (whitelist/strip)', () => {
    const result = ProfileInputSchema.safeParse({
      ...validBody,
      avatarUrl: '/x.png',
      hack: 'usun-mnie',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(validBody)
    }
  })

  it('odrzuca body bez wymaganego pola', () => {
    const { aboutMe: _omitted, ...incomplete } = validBody
    const result = ProfileInputSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Uruchom — FAIL (brak modułu schemas/profile)**

Run: `npm test -- profileSchema`
Expected: FAIL — `Cannot find module '../schemas/profile.js'`.

- [ ] **Step 3: Utwórz `backend/src/types/profile.ts`**

```ts
// Lustro kontraktu z frontend/src/types/profile.ts — pilnowane testem kontraktowym (api.spec.ts)
export interface Profile {
  firstName: string
  lastName: string
  email: string
  aboutMe: string
  avatarUrl: string
}

export const EMPTY_PROFILE: Profile = {
  firstName: '',
  lastName: '',
  email: '',
  aboutMe: '',
  avatarUrl: '',
}
```

- [ ] **Step 4: Utwórz `backend/src/schemas/profile.ts`**

```ts
import { z } from 'zod'

// Walidacja na granicy systemu (FR-12). z.object domyślnie odcina nieznane klucze (strip),
// więc avatarUrl wysłany w body PUT nigdy nie trafia do pliku.
export const ProfileInputSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.union([z.literal(''), z.email()]),
  aboutMe: z.string(),
})

export type ProfileInput = z.infer<typeof ProfileInputSchema>
```

(Zod 4: `z.email()` to top-level API — nie używaj przestarzałego `z.string().email()`.)

- [ ] **Step 5: Testy zielone**

Run: `npm test -- profileSchema`
Expected: 5 testów PASS.

- [ ] **Step 6: Commit**

```bash
cd ..
git add backend/src
git commit -m "feat(backend): add Profile type and Zod ProfileInputSchema (FR-12)"
```

---

### Task 3: `profileStore` — trwałość na dysku (TDD)

**Files:**
- Create: `backend/src/services/profileStore.ts`
- Test: `backend/src/__tests__/profileStore.spec.ts`

- [ ] **Step 1: Napisz failing testy `backend/src/__tests__/profileStore.spec.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  readProfile,
  writeProfile,
  saveAvatar,
  findAvatarPath,
  deleteProfile,
} from '../services/profileStore.js'
import { EMPTY_PROFILE } from '../types/profile.js'

let dataDir: string

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'teamable-store-'))
  process.env.PROFILE_DATA_DIR = dataDir
})

afterEach(async () => {
  delete process.env.PROFILE_DATA_DIR
  await fs.rm(dataDir, { recursive: true, force: true })
})

const input = {
  firstName: 'Anna',
  lastName: 'Nowak',
  email: 'anna@example.com',
  aboutMe: 'Cześć!',
}

describe('profileStore', () => {
  it('readProfile zwraca pusty profil, gdy plik nie istnieje (FR-9)', async () => {
    expect(await readProfile()).toEqual(EMPTY_PROFILE)
  })

  it('readProfile zwraca pusty profil, gdy plik jest uszkodzony', async () => {
    await fs.writeFile(path.join(dataDir, 'profile.json'), 'nie-json', 'utf8')
    expect(await readProfile()).toEqual(EMPTY_PROFILE)
  })

  it('writeProfile zapisuje i readProfile odczytuje (FR-8)', async () => {
    await writeProfile(input)
    expect(await readProfile()).toEqual({ ...input, avatarUrl: '' })
  })

  it('writeProfile zachowuje istniejący avatarUrl', async () => {
    await saveAvatar(Buffer.from('img'), 'png')
    const before = await readProfile()
    expect(before.avatarUrl).toMatch(/^\/api\/profile\/avatar\?v=\d+$/)

    await writeProfile(input)
    const after = await readProfile()
    expect(after.avatarUrl).toBe(before.avatarUrl)
  })

  it('writeProfile zapisuje atomowo (brak pliku .tmp po zapisie)', async () => {
    await writeProfile(input)
    const files = await fs.readdir(dataDir)
    expect(files).toContain('profile.json')
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false)
  })

  it('saveAvatar usuwa poprzedni plik o innym rozszerzeniu (FR-11, brak sierot)', async () => {
    await saveAvatar(Buffer.from('png-img'), 'png')
    await saveAvatar(Buffer.from('jpg-img'), 'jpg')
    const files = await fs.readdir(path.join(dataDir, 'uploads'))
    expect(files).toEqual(['avatar.jpg'])
  })

  it('findAvatarPath zwraca null bez uploadu i ścieżkę po uploadzie', async () => {
    expect(await findAvatarPath()).toBeNull()
    await saveAvatar(Buffer.from('img'), 'png')
    expect(await findAvatarPath()).toBe(path.join(dataDir, 'uploads', 'avatar.png'))
  })

  it('deleteProfile czyści dane i jest idempotentny (FR-13)', async () => {
    await writeProfile(input)
    await saveAvatar(Buffer.from('img'), 'png')
    await deleteProfile()
    expect(await readProfile()).toEqual(EMPTY_PROFILE)
    expect(await findAvatarPath()).toBeNull()
    await expect(deleteProfile()).resolves.toBeUndefined() // drugi raz też OK
  })
})
```

- [ ] **Step 2: Uruchom — FAIL (brak modułu)**

Run: `npm test -- profileStore`
Expected: FAIL — `Cannot find module '../services/profileStore.js'`.

- [ ] **Step 3: Utwórz `backend/src/services/profileStore.ts`**

```ts
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Profile } from '../types/profile.js'
import { EMPTY_PROFILE } from '../types/profile.js'
import type { ProfileInput } from '../schemas/profile.js'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_DATA_DIR = path.resolve(moduleDir, '../../data')

// Czytane przy każdym wywołaniu (nie raz na import), żeby testy i E2E mogły podmieniać katalog przez env.
function dataDir(): string {
  return process.env.PROFILE_DATA_DIR || DEFAULT_DATA_DIR
}

const profilePath = () => path.join(dataDir(), 'profile.json')
const uploadsDir = () => path.join(dataDir(), 'uploads')

export async function readProfile(): Promise<Profile> {
  try {
    const raw = await fs.readFile(profilePath(), 'utf8')
    return { ...EMPTY_PROFILE, ...JSON.parse(raw) }
  } catch {
    return { ...EMPTY_PROFILE }
  }
}

// Atomowy zapis: temp + rename. rename jest atomowy w obrębie systemu plików,
// więc awaria w trakcie zapisu nie zostawia uciętego JSON-a.
async function writeJson(profile: Profile): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true })
  const tmp = `${profilePath()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(profile, null, 2), 'utf8')
  await fs.rename(tmp, profilePath())
}

export async function writeProfile(input: ProfileInput): Promise<Profile> {
  const existing = await readProfile()
  const profile: Profile = { ...input, avatarUrl: existing.avatarUrl }
  await writeJson(profile)
  return profile
}

export async function findAvatarPath(): Promise<string | null> {
  try {
    const files = await fs.readdir(uploadsDir())
    const name = files.find((f) => f.startsWith('avatar.'))
    return name ? path.join(uploadsDir(), name) : null
  } catch {
    return null
  }
}

export async function saveAvatar(buffer: Buffer, ext: string): Promise<string> {
  await fs.mkdir(uploadsDir(), { recursive: true })
  const previous = await findAvatarPath()
  if (previous) await fs.rm(previous, { force: true })
  await fs.writeFile(path.join(uploadsDir(), `avatar.${ext}`), buffer)

  // ?v= to cache-busting: stała ścieżka byłaby cache'owana przez przeglądarkę
  const avatarUrl = `/api/profile/avatar?v=${Date.now()}`
  const existing = await readProfile()
  await writeJson({ ...existing, avatarUrl })
  return avatarUrl
}

export async function deleteProfile(): Promise<void> {
  await fs.rm(profilePath(), { force: true })
  await fs.rm(uploadsDir(), { recursive: true, force: true })
}
```

- [ ] **Step 4: Testy zielone**

Run: `npm test -- profileStore`
Expected: 8 testów PASS.

Uwaga na test „saveAvatar usuwa poprzedni plik": jeśli dwa kolejne `saveAvatar` wykonają się w tej samej milisekundzie, oba `?v=` będą równe — test nie porównuje `v`, więc to nie problem.

- [ ] **Step 5: Commit**

```bash
cd ..
git add backend/src
git commit -m "feat(backend): add profileStore with atomic JSON persistence and avatar files (FR-8, FR-9, FR-11, FR-13)"
```

---

### Task 4: Routing `/api/profile` + error-middleware (testy integracyjne)

**Files:**
- Create: `backend/src/middleware/errorHandler.ts`, `backend/src/routes/profile.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/__tests__/api.spec.ts`

- [ ] **Step 1: Napisz failing testy integracyjne `backend/src/__tests__/api.spec.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { createApp } from '../app.js'
import { EMPTY_PROFILE } from '../types/profile.js'

let dataDir: string
const app = createApp()

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'teamable-api-'))
  process.env.PROFILE_DATA_DIR = dataDir
})

afterEach(async () => {
  delete process.env.PROFILE_DATA_DIR
  await fs.rm(dataDir, { recursive: true, force: true })
})

const validBody = {
  firstName: 'Anna',
  lastName: 'Nowak',
  email: 'anna@example.com',
  aboutMe: 'Cześć!',
}

describe('GET /api/profile', () => {
  it('zwraca pusty profil na czystym stanie (FR-9)', async () => {
    const res = await request(app).get('/api/profile')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(EMPTY_PROFILE)
  })

  it('test kontraktowy: odpowiedź ma dokładnie pola Profile', async () => {
    const res = await request(app).get('/api/profile')
    expect(Object.keys(res.body).sort()).toEqual([
      'aboutMe',
      'avatarUrl',
      'email',
      'firstName',
      'lastName',
    ])
  })
})

describe('PUT /api/profile', () => {
  it('zapisuje poprawne body i zwraca pełny profil (FR-8)', async () => {
    const res = await request(app).put('/api/profile').send(validBody)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ...validBody, avatarUrl: '' })

    const get = await request(app).get('/api/profile')
    expect(get.body).toEqual({ ...validBody, avatarUrl: '' })
  })

  it('odrzuca niepoprawny email z 400 i formatem { error } (FR-12)', async () => {
    const res = await request(app)
      .put('/api/profile')
      .send({ ...validBody, email: 'zly-email' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Niepoprawny adres email' })

    const get = await request(app).get('/api/profile')
    expect(get.body).toEqual(EMPTY_PROFILE) // nic nie zapisano
  })

  it('akceptuje pusty email (FR-9)', async () => {
    const res = await request(app)
      .put('/api/profile')
      .send({ ...validBody, email: '' })
    expect(res.status).toBe(200)
  })

  it('ignoruje avatarUrl i nieznane pola w body (whitelist)', async () => {
    const res = await request(app)
      .put('/api/profile')
      .send({ ...validBody, avatarUrl: '/oszukany.png', hack: 1 })
    expect(res.status).toBe(200)
    expect(res.body.avatarUrl).toBe('')
    expect(res.body).not.toHaveProperty('hack')
  })

  it('odrzuca body bez wymaganego pola z 400', async () => {
    const res = await request(app).put('/api/profile').send({ firstName: 'X' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Niepoprawne dane profilu' })
  })
})

describe('DELETE /api/profile', () => {
  it('resetuje profil do pustego i jest idempotentny (FR-13)', async () => {
    await request(app).put('/api/profile').send(validBody)

    const del = await request(app).delete('/api/profile')
    expect(del.status).toBe(204)

    const get = await request(app).get('/api/profile')
    expect(get.body).toEqual(EMPTY_PROFILE)

    const delAgain = await request(app).delete('/api/profile')
    expect(delAgain.status).toBe(204)
  })
})
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npm test -- api`
Expected: FAIL — GET `/api/profile` zwraca 404 (route nie istnieje).

- [ ] **Step 3: Utwórz `backend/src/middleware/errorHandler.ts`**

```ts
import type { NextFunction, Request, Response } from 'express'
import { MulterError } from 'multer'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

// Centralny punkt mapowania wyjątków na jednolity kontrakt błędów { error } (spec 3.1).
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'Plik jest za duży (max 2 MB)' })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Wewnętrzny błąd serwera' })
}
```

- [ ] **Step 4: Utwórz `backend/src/routes/profile.ts` (na razie bez avatara)**

```ts
import { Router } from 'express'
import { ProfileInputSchema } from '../schemas/profile.js'
import { readProfile, writeProfile, deleteProfile } from '../services/profileStore.js'
import { HttpError } from '../middleware/errorHandler.js'

export const profileRouter = Router()

profileRouter.get('/', async (_req, res) => {
  res.json(await readProfile())
})

profileRouter.put('/', async (req, res) => {
  const parsed = ProfileInputSchema.safeParse(req.body)
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.some((issue) => issue.path[0] === 'email')
    throw new HttpError(400, emailIssue ? 'Niepoprawny adres email' : 'Niepoprawne dane profilu')
  }
  res.json(await writeProfile(parsed.data))
})

profileRouter.delete('/', async (_req, res) => {
  await deleteProfile()
  res.status(204).end()
})
```

- [ ] **Step 5: Podłącz router i error-middleware w `backend/src/app.ts`**

Cały nowy plik:

```ts
import express from 'express'
import cors from 'cors'
import { profileRouter } from './routes/profile.js'
import { errorHandler } from './middleware/errorHandler.js'

export function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api/profile', profileRouter)

  // Error-middleware musi być zarejestrowany jako ostatni.
  app.use(errorHandler)

  return app
}
```

- [ ] **Step 6: Testy zielone**

Run: `npm test`
Expected: wszystkie testy PASS (health + schema + store + api).

- [ ] **Step 7: Commit**

```bash
cd ..
git add backend/src
git commit -m "feat(backend): add GET/PUT/DELETE /api/profile with Zod validation and error middleware"
```

---

### Task 5: Endpointy avatara — `POST`/`GET /api/profile/avatar` (testy integracyjne)

**Files:**
- Modify: `backend/src/routes/profile.ts`
- Test: `backend/src/__tests__/api.spec.ts` (dopisz blok describe)

- [ ] **Step 1: Dopisz failing testy na końcu `backend/src/__tests__/api.spec.ts`**

```ts
describe('POST + GET /api/profile/avatar', () => {
  const png = Buffer.from('fake-png-bytes')

  it('upload obrazu zwraca avatarUrl z cache-bustingiem (FR-10)', async () => {
    const res = await request(app)
      .post('/api/profile/avatar')
      .attach('avatar', png, { filename: 'a.png', contentType: 'image/png' })
    expect(res.status).toBe(200)
    expect(res.body.avatarUrl).toMatch(/^\/api\/profile\/avatar\?v=\d+$/)

    const profile = await request(app).get('/api/profile')
    expect(profile.body.avatarUrl).toBe(res.body.avatarUrl)
  })

  it('GET serwuje obraz z poprawnym Content-Type po uploadzie', async () => {
    await request(app)
      .post('/api/profile/avatar')
      .attach('avatar', png, { filename: 'a.png', contentType: 'image/png' })
    const res = await request(app).get('/api/profile/avatar')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('image/png')
  })

  it('GET bez zdjęcia zwraca 404 { error }', async () => {
    const res = await request(app).get('/api/profile/avatar')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Brak zdjęcia' })
  })

  it('odrzuca nie-obraz z 400 { error }', async () => {
    const res = await request(app)
      .post('/api/profile/avatar')
      .attach('avatar', Buffer.from('tekst'), { filename: 'a.txt', contentType: 'text/plain' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Dozwolone tylko pliki graficzne' })
  })

  it('odrzuca plik powyżej 2 MB z 413 { error }', async () => {
    const big = Buffer.alloc(2 * 1024 * 1024 + 1)
    const res = await request(app)
      .post('/api/profile/avatar')
      .attach('avatar', big, { filename: 'big.png', contentType: 'image/png' })
    expect(res.status).toBe(413)
    expect(res.body).toEqual({ error: 'Plik jest za duży (max 2 MB)' })
  })

  it('odrzuca żądanie bez pliku z 400', async () => {
    const res = await request(app).post('/api/profile/avatar')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Brak pliku' })
  })

  it('DELETE /api/profile usuwa też zdjęcie (FR-13)', async () => {
    await request(app)
      .post('/api/profile/avatar')
      .attach('avatar', png, { filename: 'a.png', contentType: 'image/png' })
    await request(app).delete('/api/profile')
    const res = await request(app).get('/api/profile/avatar')
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Uruchom — FAIL (404 na POST avatar)**

Run: `npm test -- api`
Expected: nowe testy FAIL (route nie istnieje), stare PASS.

- [ ] **Step 3: Dodaj endpointy avatara do `backend/src/routes/profile.ts`**

Cały nowy plik:

```ts
import { Router } from 'express'
import multer from 'multer'
import { ProfileInputSchema } from '../schemas/profile.js'
import {
  readProfile,
  writeProfile,
  deleteProfile,
  saveAvatar,
  findAvatarPath,
} from '../services/profileStore.js'
import { HttpError } from '../middleware/errorHandler.js'

// Jawna lista typów (zamiast image/*): wyklucza m.in. image/svg+xml, który może zawierać skrypty.
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) cb(null, true)
    else cb(new HttpError(400, 'Dozwolone tylko pliki graficzne'))
  },
})

export const profileRouter = Router()

profileRouter.get('/', async (_req, res) => {
  res.json(await readProfile())
})

profileRouter.put('/', async (req, res) => {
  const parsed = ProfileInputSchema.safeParse(req.body)
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.some((issue) => issue.path[0] === 'email')
    throw new HttpError(400, emailIssue ? 'Niepoprawny adres email' : 'Niepoprawne dane profilu')
  }
  res.json(await writeProfile(parsed.data))
})

profileRouter.delete('/', async (_req, res) => {
  await deleteProfile()
  res.status(204).end()
})

profileRouter.post('/avatar', upload.single('avatar'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Brak pliku')
  const ext = ALLOWED_TYPES[req.file.mimetype]
  if (!ext) throw new HttpError(400, 'Dozwolone tylko pliki graficzne')
  const avatarUrl = await saveAvatar(req.file.buffer, ext)
  res.json({ avatarUrl })
})

profileRouter.get('/avatar', async (_req, res) => {
  const avatarPath = await findAvatarPath()
  if (!avatarPath) throw new HttpError(404, 'Brak zdjęcia')
  // sendFile ustawia Content-Type na podstawie rozszerzenia pliku
  res.sendFile(avatarPath)
})
```

- [ ] **Step 4: Wszystkie testy + coverage zielone**

Run: `npm test && npm run test:coverage && npm run type-check && npm run lint`
Expected: wszystkie PASS, raport coverage wygenerowany, brak błędów typów/lint.

- [ ] **Step 5: Smoke-test ręczny serwera**

```bash
npm run dev &
sleep 2
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/profile
kill %1
```

Expected: `{"status":"ok"}` oraz pusty profil `{"firstName":"",...}`.

- [ ] **Step 6: Commit**

```bash
cd ..
git add backend/src
git commit -m "feat(backend): add avatar upload/serve endpoints with multer (FR-10)"
```

---

### Task 6: Frontend — pusty `DEFAULT_PROFILE` + `profileService` przez HTTP (TDD)

**Files:**
- Modify: `frontend/src/types/profile.ts`, `frontend/src/services/profileService.ts`, `frontend/env.d.ts`
- Test: `frontend/src/services/__tests__/profileService.spec.ts` (pełna podmiana)

- [ ] **Step 1: Zmień `frontend/src/types/profile.ts` — pusty seed (FR-9)**

Cały nowy plik:

```ts
export interface Profile {
  firstName: string
  lastName: string
  email: string
  aboutMe: string
  avatarUrl: string
}

// Etap 2: pierwszy start = pusty profil (FR-9). Realny stan przychodzi z backendu.
export const DEFAULT_PROFILE: Profile = {
  firstName: '',
  lastName: '',
  email: '',
  aboutMe: '',
  avatarUrl: '',
}
```

- [ ] **Step 2: Zadeklaruj typ env w `frontend/env.d.ts`**

Dopisz na końcu pliku (nie usuwaj istniejącej linii `/// <reference types="vite/client" />`):

```ts
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 3: Podmień testy `frontend/src/services/__tests__/profileService.spec.ts` (failing)**

Cały nowy plik:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getProfile,
  saveProfile,
  uploadAvatar,
  deleteProfile,
  ApiError,
} from '../profileService'
import type { Profile } from '../../types/profile'

const profile: Profile = {
  firstName: 'Anna',
  lastName: 'Nowak',
  email: 'anna@example.com',
  aboutMe: 'Test',
  avatarUrl: '',
}

function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('profileService', () => {
  it('getProfile pobiera profil z GET /api/profile', async () => {
    fetchMock.mockResolvedValue(okResponse(profile))
    expect(await getProfile()).toEqual(profile)
    expect(fetchMock).toHaveBeenCalledWith('/api/profile', undefined)
  })

  it('saveProfile wysyła PUT z JSON-em i zwraca zapisany profil', async () => {
    fetchMock.mockResolvedValue(okResponse(profile))
    expect(await saveProfile(profile)).toEqual(profile)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/profile')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual(profile)
  })

  it('uploadAvatar wysyła plik jako multipart i zwraca avatarUrl', async () => {
    fetchMock.mockResolvedValue(okResponse({ avatarUrl: '/api/profile/avatar?v=1' }))
    const file = new File(['img'], 'a.png', { type: 'image/png' })
    expect(await uploadAvatar(file)).toEqual({ avatarUrl: '/api/profile/avatar?v=1' })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/profile/avatar')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
  })

  it('deleteProfile wysyła DELETE', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await deleteProfile()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/profile')
    expect(init.method).toBe('DELETE')
  })

  it('rzuca ApiError z komunikatem { error } z body przy statusie 4xx', async () => {
    fetchMock.mockResolvedValue(okResponse({ error: 'Niepoprawny adres email' }, 400))
    await expect(saveProfile(profile)).rejects.toMatchObject({
      status: 400,
      message: 'Niepoprawny adres email',
    })
    await expect(saveProfile(profile)).rejects.toBeInstanceOf(ApiError)
  })

  it('rzuca ApiError z generycznym komunikatem przy błędzie sieci', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getProfile()).rejects.toMatchObject({
      status: 0,
      message: 'Backend jest nieosiągalny',
    })
  })
})
```

- [ ] **Step 4: Uruchom — FAIL**

Run: `cd frontend && npm run test:unit -- --run profileService`
Expected: FAIL — `profileService` nie eksportuje `uploadAvatar`/`deleteProfile`/`ApiError`, a `getProfile` używa localStorage.

- [ ] **Step 5: Podmień `frontend/src/services/profileService.ts`**

Cały nowy plik:

```ts
import type { Profile } from '../types/profile'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

// Jeden przewidywalny kontrakt błędów dla warstw wyżej (spec 4):
// HTTP 4xx/5xx → ApiError z komunikatem { error } z body; błąd sieci → ApiError(0).
async function request(path: string, init?: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, init)
  } catch {
    throw new ApiError(0, 'Backend jest nieosiągalny')
  }
  if (!response.ok) {
    let message = 'Błąd serwera'
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // body nie było JSON-em — zostaje komunikat generyczny
    }
    throw new ApiError(response.status, message)
  }
  return response
}

export async function getProfile(): Promise<Profile> {
  const response = await request('/api/profile')
  return response.json()
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const response = await request('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  })
  return response.json()
}

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const formData = new FormData()
  formData.append('avatar', file)
  const response = await request('/api/profile/avatar', {
    method: 'POST',
    body: formData,
  })
  return response.json()
}

export async function deleteProfile(): Promise<void> {
  await request('/api/profile', { method: 'DELETE' })
}
```

(Backend i tak odcina `avatarUrl` z body PUT — wysyłanie pełnego `Profile` jest OK i trzyma prosty kontrakt szwu.)

- [ ] **Step 6: Testy zielone**

Run: `npm run test:unit -- --run profileService`
Expected: 6 testów PASS.

- [ ] **Step 7: Commit**

```bash
cd ..
git add frontend/src frontend/env.d.ts
git commit -m "feat(frontend): rewrite profileService to HTTP API, empty default profile (FR-9)"
```

---

### Task 7: `useProfile` async — loading, error, save z avatarem (TDD)

**Files:**
- Modify: `frontend/src/composables/useProfile.ts`
- Test: `frontend/src/composables/__tests__/useProfile.spec.ts` (pełna podmiana)

- [ ] **Step 1: Podmień testy `frontend/src/composables/__tests__/useProfile.spec.ts` (failing)**

Cały nowy plik:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useProfile } from '../useProfile'
import { getProfile, saveProfile, uploadAvatar } from '../../services/profileService'
import type { Profile } from '../../types/profile'

vi.mock('../../services/profileService', () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
  uploadAvatar: vi.fn(),
}))

const remote: Profile = {
  firstName: 'Anna',
  lastName: 'Nowak',
  email: 'anna@example.com',
  aboutMe: 'Z backendu',
  avatarUrl: '',
}

async function flush() {
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  vi.mocked(getProfile).mockReset()
  vi.mocked(saveProfile).mockReset()
  vi.mocked(uploadAvatar).mockReset()
})

describe('useProfile', () => {
  it('ładuje profil z serwisu i kończy loading', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    const { profile, loading, error } = useProfile()
    expect(loading.value).toBe(true)
    await flush()
    expect(loading.value).toBe(false)
    expect(error.value).toBe('')
    expect(profile.value).toEqual(remote)
  })

  it('ustawia error, gdy load się nie powiedzie', async () => {
    vi.mocked(getProfile).mockRejectedValue(new Error('Backend jest nieosiągalny'))
    const { loading, error } = useProfile()
    await flush()
    expect(loading.value).toBe(false)
    expect(error.value).toBe('Backend jest nieosiągalny')
  })

  it('save bez zdjęcia woła saveProfile i aktualizuje stan', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    const updated = { ...remote, firstName: 'Ola' }
    vi.mocked(saveProfile).mockResolvedValue(updated)

    const { profile, save } = useProfile()
    await flush()
    await save(updated, null)

    expect(uploadAvatar).not.toHaveBeenCalled()
    expect(saveProfile).toHaveBeenCalledWith(updated)
    expect(profile.value).toEqual(updated)
  })

  it('save ze zdjęciem: najpierw upload, potem PUT z nowym avatarUrl', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    vi.mocked(uploadAvatar).mockResolvedValue({ avatarUrl: '/api/profile/avatar?v=42' })
    const saved = { ...remote, avatarUrl: '/api/profile/avatar?v=42' }
    vi.mocked(saveProfile).mockResolvedValue(saved)

    const { profile, save } = useProfile()
    await flush()
    const file = new File(['img'], 'a.png', { type: 'image/png' })
    await save({ ...remote }, file)

    expect(uploadAvatar).toHaveBeenCalledWith(file)
    expect(saveProfile).toHaveBeenCalledWith(saved)
    expect(profile.value.avatarUrl).toBe('/api/profile/avatar?v=42')
  })

  it('save propaguje błąd uploadu i NIE woła saveProfile (spec 4)', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    vi.mocked(uploadAvatar).mockRejectedValue(new Error('Plik jest za duży (max 2 MB)'))

    const { save } = useProfile()
    await flush()
    const file = new File(['img'], 'big.png', { type: 'image/png' })

    await expect(save({ ...remote }, file)).rejects.toThrow('Plik jest za duży (max 2 MB)')
    expect(saveProfile).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npm run test:unit -- --run useProfile`
Expected: FAIL — `useProfile` nie zwraca `loading`/`error`, `save` ma inną sygnaturę.

- [ ] **Step 3: Podmień `frontend/src/composables/useProfile.ts`**

Cały nowy plik:

```ts
import { ref } from 'vue'
import { getProfile, saveProfile, uploadAvatar } from '../services/profileService'
import { DEFAULT_PROFILE, type Profile } from '../types/profile'

export function useProfile() {
  const profile = ref<Profile>({ ...DEFAULT_PROFILE })
  const loading = ref(true)
  const error = ref('')

  async function load(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      profile.value = await getProfile()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Nie udało się wczytać profilu.'
    } finally {
      loading.value = false
    }
  }

  // Kolejność (spec 4): najpierw upload zdjęcia, potem PUT pól.
  // Błąd uploadu przerywa zapis (rzuca) — profil nie zmienia się częściowo.
  async function save(updated: Profile, avatarFile: File | null = null): Promise<void> {
    const next: Profile = { ...updated }
    if (avatarFile) {
      const { avatarUrl } = await uploadAvatar(avatarFile)
      next.avatarUrl = avatarUrl
    }
    profile.value = await saveProfile(next)
  }

  void load()

  return { profile, loading, error, save, reload: load }
}
```

- [ ] **Step 4: Testy zielone**

Run: `npm run test:unit -- --run useProfile`
Expected: 5 testów PASS.

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/src
git commit -m "feat(frontend): async useProfile with loading/error and avatar-aware save"
```

---

### Task 8: Komponenty — odroczony upload avatara, Anuluj, stany w App (TDD)

**Files:**
- Modify: `frontend/src/components/ProfileForm.vue`, `frontend/src/App.vue`
- Test: `frontend/src/components/__tests__/ProfileForm.spec.ts` (pełna podmiana), `frontend/src/__tests__/App.spec.ts` (pełna podmiana)

- [ ] **Step 1: Podmień testy `frontend/src/components/__tests__/ProfileForm.spec.ts` (failing)**

Cały nowy plik:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ProfileForm from '../ProfileForm.vue'
import type { Profile } from '../../types/profile'

const profile: Profile = {
  firstName: 'Anna',
  lastName: 'Nowak',
  email: 'anna@example.com',
  aboutMe: 'Test',
  avatarUrl: '',
}

beforeEach(() => {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:preview'),
    revokeObjectURL: vi.fn(),
  })
})

describe('ProfileForm', () => {
  it('emituje save z profilem i avatarFile=null, gdy nie wybrano zdjęcia (FR-4)', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    await wrapper.find('[data-test="firstName"]').setValue('Ola')
    await wrapper.find('form').trigger('submit')

    const emitted = wrapper.emitted('save')
    expect(emitted).toHaveLength(1)
    expect(emitted![0]![0]).toEqual({
      profile: { ...profile, firstName: 'Ola' },
      avatarFile: null,
    })
  })

  it('blokuje zapis przy niepustym niepoprawnym emailu (FR-6)', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    await wrapper.find('[data-test="email"]').setValue('zly-email')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.find('[data-test="email-error"]').text()).not.toBe('')
  })

  it('pozwala zapisać pusty email (FR-9)', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    await wrapper.find('[data-test="email"]').setValue('')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('wybór pliku pokazuje lokalny podgląd bez wysyłki (FR-5, FR-11)', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    const file = new File(['img'], 'a.png', { type: 'image/png' })
    const input = wrapper.find('[data-test="avatar"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')

    const img = wrapper.find('img[alt="Podgląd zdjęcia"]')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('blob:preview')
  })

  it('po wyborze pliku emituje save z avatarFile', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    const file = new File(['img'], 'a.png', { type: 'image/png' })
    const input = wrapper.find('[data-test="avatar"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await wrapper.find('form').trigger('submit')

    const payload = wrapper.emitted('save')![0]![0] as { avatarFile: File | null }
    expect(payload.avatarFile).toBe(file)
  })

  it('emituje cancel po kliknięciu Anuluj (FR-11)', async () => {
    const wrapper = mount(ProfileForm, { props: { profile } })
    await wrapper.find('[data-test="cancel-button"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('pokazuje błąd serwera przekazany propem (spec 4)', () => {
    const wrapper = mount(ProfileForm, {
      props: { profile, serverError: 'Niepoprawny adres email' },
    })
    expect(wrapper.find('[data-test="server-error"]').text()).toBe('Niepoprawny adres email')
  })
})
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npm run test:unit -- --run ProfileForm`
Expected: FAIL — emit `save` ma stary kształt (sam `Profile`), brak `server-error`, walidacja odrzuca pusty email.

- [ ] **Step 3: Podmień `frontend/src/components/ProfileForm.vue`**

Cały nowy plik:

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import type { Profile } from '../types/profile'
import { isValidEmail } from '../utils/validation'

const props = defineProps<{ profile: Profile; serverError?: string }>()
const emit = defineEmits<{
  save: [payload: { profile: Profile; avatarFile: File | null }]
  cancel: []
}>()

const form = reactive<Profile>({ ...props.profile })
const emailError = ref('')
const avatarFile = ref<File | null>(null)
const previewUrl = ref('')

// Podgląd lokalny (object URL) ma priorytet; bez wyboru pliku pokazujemy zapisany avatar.
const displayedAvatar = computed(() => previewUrl.value || form.avatarUrl)

function onAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  avatarFile.value = file
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(file)
}

function onSave() {
  // Pusty email dozwolony (FR-9); walidujemy tylko niepusty (FR-6).
  if (form.email !== '' && !isValidEmail(form.email)) {
    emailError.value = 'Podaj poprawny adres email.'
    return
  }
  emailError.value = ''
  emit('save', { profile: { ...form }, avatarFile: avatarFile.value })
}

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <section class="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
    <form class="flex flex-col gap-4" novalidate @submit.prevent="onSave">
      <div class="flex flex-col items-center gap-3">
        <img
          v-if="displayedAvatar"
          :src="displayedAvatar"
          alt="Podgląd zdjęcia"
          class="h-24 w-24 rounded-full object-cover"
        />
        <label class="text-sm text-indigo-600">
          Wczytaj zdjęcie
          <input
            data-test="avatar"
            type="file"
            accept="image/*"
            class="mt-1 block text-xs"
            @change="onAvatarChange"
          />
        </label>
      </div>

      <label class="flex flex-col gap-1 text-sm text-gray-700">
        Imię
        <input
          data-test="firstName"
          v-model="form.firstName"
          type="text"
          class="rounded-lg border border-gray-300 px-3 py-2"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm text-gray-700">
        Nazwisko
        <input
          data-test="lastName"
          v-model="form.lastName"
          type="text"
          class="rounded-lg border border-gray-300 px-3 py-2"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm text-gray-700">
        Email
        <input
          data-test="email"
          v-model="form.email"
          type="email"
          class="rounded-lg border border-gray-300 px-3 py-2"
        />
        <span data-test="email-error" class="text-xs text-red-600">{{ emailError }}</span>
      </label>

      <label class="flex flex-col gap-1 text-sm text-gray-700">
        About me
        <textarea
          data-test="aboutMe"
          v-model="form.aboutMe"
          rows="3"
          class="rounded-lg border border-gray-300 px-3 py-2"
        ></textarea>
      </label>

      <p v-if="serverError" data-test="server-error" class="text-sm text-red-600">
        {{ serverError }}
      </p>

      <div class="mt-2 flex justify-end gap-3">
        <button
          data-test="cancel-button"
          type="button"
          class="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          @click="emit('cancel')"
        >
          Anuluj
        </button>
        <button
          data-test="save-button"
          type="submit"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Zapisz
        </button>
      </div>
    </form>
  </section>
</template>
```

- [ ] **Step 4: Testy ProfileForm zielone**

Run: `npm run test:unit -- --run ProfileForm`
Expected: 7 testów PASS.

- [ ] **Step 5: Podmień testy `frontend/src/__tests__/App.spec.ts` (failing dla nowego App)**

Cały nowy plik:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from '../App.vue'
import { getProfile, saveProfile } from '../services/profileService'
import type { Profile } from '../types/profile'

vi.mock('../services/profileService', () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
  uploadAvatar: vi.fn(),
}))

const remote: Profile = {
  firstName: 'Anna',
  lastName: 'Nowak',
  email: 'anna@example.com',
  aboutMe: 'Z backendu',
  avatarUrl: '',
}

beforeEach(() => {
  vi.mocked(getProfile).mockReset()
  vi.mocked(saveProfile).mockReset()
})

describe('App', () => {
  it('pokazuje loading, potem kartę profilu (FR-1)', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    const wrapper = mount(App)
    expect(wrapper.find('[data-test="loading"]').exists()).toBe(true)
    await flushPromises()
    expect(wrapper.find('[data-test="loading"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Anna')
  })

  it('pokazuje błąd, gdy backend nieosiągalny (spec 4)', async () => {
    vi.mocked(getProfile).mockRejectedValue(new Error('Backend jest nieosiągalny'))
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.find('[data-test="load-error"]').text()).toBe('Backend jest nieosiągalny')
  })

  it('przełącza w tryb edycji i wraca po zapisie (FR-3, FR-4)', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    const updated = { ...remote, firstName: 'Ola' }
    vi.mocked(saveProfile).mockResolvedValue(updated)

    const wrapper = mount(App)
    await flushPromises()
    await wrapper.find('[data-test="edit-button"]').trigger('click')
    expect(wrapper.find('form').exists()).toBe(true)

    await wrapper.find('[data-test="firstName"]').setValue('Ola')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Ola')
  })

  it('przy błędzie zapisu zostaje w edycji i pokazuje komunikat (spec 4)', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    vi.mocked(saveProfile).mockRejectedValue(new Error('Niepoprawny adres email'))

    const wrapper = mount(App)
    await flushPromises()
    await wrapper.find('[data-test="edit-button"]').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.find('[data-test="server-error"]').text()).toBe('Niepoprawny adres email')
  })

  it('Anuluj wraca do karty bez zapisu (FR-11)', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    const wrapper = mount(App)
    await flushPromises()
    await wrapper.find('[data-test="edit-button"]').trigger('click')
    await wrapper.find('[data-test="cancel-button"]').trigger('click')

    expect(wrapper.find('form').exists()).toBe(false)
    expect(saveProfile).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Podmień `frontend/src/App.vue`**

Cały nowy plik:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useProfile } from './composables/useProfile'
import ProfileCard from './components/ProfileCard.vue'
import ProfileForm from './components/ProfileForm.vue'
import type { Profile } from './types/profile'

const { profile, loading, error, save } = useProfile()
const isEditing = ref(false)
const saveError = ref('')

async function onSave(payload: { profile: Profile; avatarFile: File | null }) {
  saveError.value = ''
  try {
    await save(payload.profile, payload.avatarFile)
    isEditing.value = false
  } catch (e) {
    // Formularz zostaje otwarty — użytkownik nie traci wpisanych danych (spec 4).
    saveError.value = e instanceof Error ? e.message : 'Zapis nie powiódł się.'
  }
}

function onCancel() {
  saveError.value = ''
  isEditing.value = false
}
</script>

<template>
  <main class="min-h-screen bg-gray-50 px-4 py-12">
    <p v-if="loading" data-test="loading" class="text-center text-gray-500">
      Wczytywanie profilu…
    </p>
    <p v-else-if="error" data-test="load-error" class="text-center text-red-600">
      {{ error }}
    </p>
    <ProfileCard v-else-if="!isEditing" :profile="profile" @edit="isEditing = true" />
    <ProfileForm
      v-else
      :profile="profile"
      :server-error="saveError"
      @save="onSave"
      @cancel="onCancel"
    />
  </main>
</template>
```

- [ ] **Step 7: Wszystkie testy frontendu + type-check + lint zielone**

Run: `npm run test:unit -- --run && npm run type-check && npm run lint`
Expected: wszystkie PASS (w tym istniejące ProfileCard.spec i validation.spec — bez zmian), brak błędów.

- [ ] **Step 8: Commit**

```bash
cd ..
git add frontend/src
git commit -m "feat(frontend): deferred avatar upload, cancel without persisting, loading/error states (FR-11)"
```

---

### Task 9: Proxy Vite + `.env.example` frontendu

**Files:**
- Modify: `frontend/vite.config.ts`
- Create: `frontend/.env.example`

- [ ] **Step 1: Dodaj proxy do `frontend/vite.config.ts`**

Cały nowy plik:

```ts
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Dev i preview są same-origin z API: /api proxowane do backendu (spec 4).
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  preview: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
```

- [ ] **Step 2: Utwórz `frontend/.env.example`**

```bash
# Baza URL API. Puste = same-origin (dev/preview przez proxy Vite).
# W buildzie produkcyjnym ustaw np. https://api.example.com
VITE_API_BASE_URL=
```

- [ ] **Step 3: Smoke-test dev full-stack**

```bash
cd ../backend && npm run dev &
sleep 2
cd ../frontend && npm run dev &
sleep 3
curl -s http://localhost:5173/api/health
kill %1 %2
```

Expected: `{"status":"ok"}` (proxy działa).

- [ ] **Step 4: Commit**

```bash
cd ..
git add frontend/vite.config.ts frontend/.env.example
git commit -m "feat(frontend): vite proxy /api to backend and env example"
```

---

### Task 10: Full-stack E2E (Playwright)

**Files:**
- Modify: `frontend/playwright.config.ts` (sekcja `webServer`), `frontend/e2e/profile.spec.ts` (pełna podmiana)

- [ ] **Step 1: Podmień sekcję `webServer` w `frontend/playwright.config.ts`**

Zamień istniejący obiekt `webServer: { ... }` (na końcu configu) na tablicę dwóch serwerów:

```ts
  /* Run backend + frontend before starting the tests */
  webServer: [
    {
      // Backend na świeżym, tymczasowym katalogu danych (czysty stan).
      command: 'npm --prefix ../backend run start:e2e',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run build && npm run preview',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
    },
  ],
```

Reszta configu (baseURL `http://localhost:4173`, `testIdAttribute: 'data-test'`, projekt chromium) bez zmian.

- [ ] **Step 2: Podmień `frontend/e2e/profile.spec.ts`**

Cały nowy plik:

```ts
import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Reset stanu backendu realnym endpointem — stan „pierwsze uruchomienie" (FR-13).
test.beforeEach(async ({ request }) => {
  const res = await request.delete('/api/profile')
  expect(res.status()).toBe(204)
})

test('pusty profil na czystym stanie (FR-9)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('edit-button').click()
  await expect(page.getByTestId('firstName')).toHaveValue('')
  await expect(page.getByTestId('email')).toHaveValue('')
  await expect(page.getByAltText('Podgląd zdjęcia')).toBeHidden()
})

test('edycja i zapis profilu utrwala dane po reloadzie przez backend (FR-3, FR-4, FR-8)', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('edit-button').click()
  await page.getByTestId('firstName').fill('Grażyna')
  await page.getByTestId('email').fill('grazyna@example.com')
  await page.getByTestId('save-button').click()

  await expect(page.getByTestId('edit-button')).toBeVisible()
  await expect(page.getByText('Grażyna')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Grażyna')).toBeVisible()
})

test('niepoprawny email blokuje zapis (FR-6)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('edit-button').click()
  await page.getByTestId('email').fill('zly-email')
  await page.getByTestId('save-button').click()

  await expect(page.getByTestId('save-button')).toBeVisible()
  await expect(page.getByTestId('email-error')).not.toBeEmpty()
})

test('upload zdjęcia: podgląd, zapis i trwałość po reloadzie (FR-5, FR-10)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('edit-button').click()
  const fileInput = page.locator('input[data-test="avatar"]')
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures/avatar.png'))

  await expect(page.getByAltText('Podgląd zdjęcia')).toBeVisible()

  await page.getByTestId('save-button').click()
  await expect(page.getByTestId('edit-button')).toBeVisible()
  await expect(page.getByAltText('Zdjęcie profilowe')).toBeVisible()

  await page.reload()
  await expect(page.getByAltText('Zdjęcie profilowe')).toBeVisible()
})

test('Anuluj po wybraniu zdjęcia nic nie utrwala (FR-11)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('edit-button').click()
  const fileInput = page.locator('input[data-test="avatar"]')
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures/avatar.png'))
  await expect(page.getByAltText('Podgląd zdjęcia')).toBeVisible()

  await page.getByTestId('cancel-button').click()
  await page.reload()
  await expect(page.getByAltText('Zdjęcie profilowe')).toBeHidden()

  // Backend faktycznie nie ma zdjęcia (nie tylko UI):
  const res = await page.request.get('/api/profile/avatar')
  expect(res.status()).toBe(404)
})
```

- [ ] **Step 3: Uruchom E2E lokalnie**

Run: `cd frontend && npm run test:e2e`
Expected: 5 testów PASS (Playwright sam startuje backend na temp katalogu + preview frontendu).

Jeśli backend wisi po testach: `reuseExistingServer: true` lokalnie ponownie użyje działającego procesu — zabij ręcznie (`lsof -ti:3001 | xargs kill`) i uruchom ponownie.

- [ ] **Step 4: Commit**

```bash
cd ..
git add frontend/playwright.config.ts frontend/e2e
git commit -m "test(e2e): full-stack scenarios against real backend (FR-8..FR-11, FR-13)"
```

---

### Task 11: CI — trzy joby i dwa artefakty

**Files:**
- Modify: `.github/workflows/ci.yml` (pełna podmiana)

- [ ] **Step 1: Podmień `.github/workflows/ci.yml`**

Cały nowy plik:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npx prettier --check src

      - name: Type check
        run: npm run type-check

      - name: Unit tests + coverage
        run: npm run test:unit:coverage

      - name: Build
        run: npm run build

      - name: Upload frontend artifact
        uses: actions/upload-artifact@v4
        with:
          name: frontend-dist
          path: frontend/dist

  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npx prettier --check src

      - name: Type check
        run: npm run type-check

      - name: Unit + integration tests + coverage
        run: npm run test:coverage

      - name: Build
        run: npm run build

      - name: Upload backend artifact
        uses: actions/upload-artifact@v4
        with:
          name: backend-dist
          path: |
            backend/dist
            backend/package.json
            backend/package-lock.json

  e2e:
    needs: [frontend, backend]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: |
            frontend/package-lock.json
            backend/package-lock.json

      - name: Install backend dependencies
        run: npm ci
        working-directory: backend

      - name: Install frontend dependencies
        run: npm ci
        working-directory: frontend

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
        working-directory: frontend

      # Playwright webServer startuje backend (temp PROFILE_DATA_DIR) i frontend preview,
      # czekając na /api/health i :4173 (spec 6).
      - name: E2E tests
        run: npm run test:e2e
        working-directory: frontend

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: frontend/playwright-report
          if-no-files-found: ignore
```

- [ ] **Step 2: Walidacja składni YAML lokalnie**

Run: `npx --yes yaml-lint .github/workflows/ci.yml || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('OK')"`
Expected: `OK` (lub brak błędów yaml-lint).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: split pipeline into frontend/backend/e2e jobs with two build artifacts"
```

---

### Task 12: Lint-staged, README, link planu w requirements — domknięcie

**Files:**
- Modify: `package.json` (root, sekcja lint-staged), `README.md`, `requirements.md` (tylko link w 2.4)

- [ ] **Step 1: Rozszerz `lint-staged` w root `package.json`**

Zamień sekcję `lint-staged` na:

```json
  "lint-staged": {
    "frontend/**/*.{ts,vue,js}": [
      "prettier --write",
      "eslint --fix"
    ],
    "frontend/**/*.{json,css,md}": [
      "prettier --write"
    ],
    "backend/**/*.ts": [
      "prettier --write",
      "eslint --fix --config backend/eslint.config.js"
    ],
    "backend/**/*.json": [
      "prettier --write"
    ]
  },
```

(Jawne `--config backend/eslint.config.js`, bo lint-staged uruchamia eslint z roota, a root `eslint.config.js` obejmuje tylko `frontend/**`.)

- [ ] **Step 2: Sprawdź hook na próbnym pliku**

```bash
echo "export const x = 1" > backend/src/lintcheck.ts
git add backend/src/lintcheck.ts
git commit -m "chore: lint-staged check" --dry-run || true
npx lint-staged --diff="HEAD" || true
rm backend/src/lintcheck.ts
git reset backend/src/lintcheck.ts 2>/dev/null || true
```

Expected: lint-staged przetwarza plik backendu bez błędu „no matching configuration".

- [ ] **Step 3: Zaktualizuj `README.md`**

Dopisz/zmień sekcje (dopasuj do istniejącej struktury README):

```markdown
## Uruchomienie lokalne (full-stack)

| Krok | Komenda |
|------|---------|
| Backend (dev, port 3001) | `cd backend && npm install && npm run dev` |
| Frontend (dev, port 5173, proxy /api → 3001) | `cd frontend && npm install && npm run dev` |

Zmienne środowiskowe: patrz `backend/.env.example` (`PORT`, `PROFILE_DATA_DIR`)
i `frontend/.env.example` (`VITE_API_BASE_URL`; puste = same-origin przez proxy).

Dane backendu trafiają do `backend/data/` (gitignored): `profile.json` + `uploads/`.

## Testy

| Poziom | Komenda |
|--------|---------|
| Backend unit + integracyjne | `cd backend && npm test` |
| Backend coverage | `cd backend && npm run test:coverage` |
| Frontend unit | `cd frontend && npm run test:unit` |
| Full-stack E2E (Playwright startuje oba serwery) | `cd frontend && npm run test:e2e` |

## Artefakty CI

Pipeline buduje i publikuje dwa niezależne artefakty: `frontend-dist` (statyczny build Vite)
i `backend-dist` (skompilowany `dist/` + pliki `package*` — zależności produkcyjne instalowane
przy wdrożeniu). Job `e2e` uruchamia testy Playwright przeciwko prawdziwemu backendowi.
```

- [ ] **Step 4: Podlinkuj plan w `requirements.md` (sekcja 2.4)**

W tabeli 2.4 zamień `_(do utworzenia po brainstormingu)_` na:

```markdown
[2026-06-10-etap2-backend.md](docs/superpowers/plans/2026-06-10-etap2-backend.md)
```

- [ ] **Step 5: Finalna weryfikacja całości (Definition of Done)**

```bash
cd backend && npm run lint && npm run type-check && npm run test:coverage && npm run build && cd ..
cd frontend && npm run lint && npm run type-check && npm run test:unit -- --run && npm run build && npm run test:e2e && cd ..
```

Expected: wszystko zielone. To pokrywa checklistę DoD ze specu (sekcja 9).

- [ ] **Step 6: Commit końcowy**

```bash
git add package.json README.md requirements.md
git commit -m "docs: full-stack run instructions, backend lint-staged, link etap2 plan"
```

---

## Pokrycie wymagań (sanity check przy review)

| Wymaganie | Task |
|---|---|
| FR-8 trwałość przez backend | 3, 4, 10 |
| FR-9 pusty start | 2, 3, 4, 6, 10 |
| FR-10 zdjęcie jako plik na serwerze | 3, 5, 7, 10 |
| FR-11 Anuluj bez utrwalania, brak sierot | 3, 8, 10 |
| FR-12 walidacja serwerowa (Zod) | 2, 4 |
| FR-13 reset/DELETE | 3, 4, 10 |
| Kontrakt API + format błędów | 4, 5, 6 |
| Testy integracyjne | 4, 5, 10 |
| Build wielu artefaktów | 11 |
| Coverage backendu | 5, 11 |
| Proxy/env config | 9 |
| README/requirements | 12 |
