# Etap 3 — Integracja z MongoDB — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wymienić trwałość backendu z pliku JSON na MongoDB za istniejącym szwem `profileStore.ts`, bez zmiany kontraktu API ani frontendu, dokładając DevOps-owe praktyki etapu: migracje (migrate-mongo), testy z bazą na kontenerach (Testcontainers) i seedy.

**Architecture:** Profil zapisywany jako dokument-singleton (`_id: 'profile'`) w MongoDB przez Mongoose; zdjęcie pozostaje plikiem na dysku (jak Etap 2), w dokumencie trzymany jest tylko `avatarUrl`. Połączenie nawiązywane przy starcie (`index.ts`), `/api/health` raportuje stan połączenia. Migracje i testy są odizolowane: migracje to pliki CommonJS uruchamiane programowo przez `node scripts/migrate.cjs`, testy podnoszą realny `mongod` przez Testcontainers w `globalSetup` Vitest, a E2E przez orkiestrator, który startuje kontener i `migrate:up` zanim uruchomi Playwrighta.

**Tech Stack:** Node 20 + Express 5 + TypeScript (ESM), Mongoose 8, migrate-mongo 11 (migracje `.cjs`), @testcontainers/mongodb, Vitest + supertest, Playwright.

**Źródło:** [spec Etapu 3](../specs/2026-06-11-etap3-mongodb-design.md). Zachowujemy FR-8…FR-13 (sekcja 4.1 requirements) — zmienia się tylko mechanizm trwałości.

> **Wymóg środowiska:** od tego etapu uruchomienie testów backendu i E2E wymaga działającego Dockera (Testcontainers). Bez Dockera `npm test` w `backend/` nie wystartuje (zatrzyma się na `globalSetup`).

---

## File Structure

**Tworzymy:**
- `backend/src/models/Profile.ts` — schema + model Mongoose (singleton), eksport `ProfileModel`, `PROFILE_ID`, `ProfileDoc`.
- `backend/src/db/connection.ts` — `connectDb` / `disconnectDb` / `isDbConnected`.
- `backend/src/services/seedProfile.ts` — `seedDemoProfile()` + `DEMO_PROFILE` (logika seeda, testowalna).
- `backend/src/__tests__/setup/mongo-global-setup.ts` — Vitest globalSetup: start/stop kontenera Mongo, `provide('MONGODB_URI')`.
- `backend/src/__tests__/setup/mongo-test-setup.ts` — Vitest setupFile: `connectDb` przed plikiem testowym, reset kolekcji w `beforeEach`.
- `backend/migrations/20260611120000-import-legacy-profile.cjs` — migracja #1 (import legacy `profile.json`).
- `backend/scripts/migrate.cjs` — programowy runner migrate-mongo (CommonJS, bez TS).
- `backend/scripts/seed.ts` — skrypt seeda (łączy się i woła `seedDemoProfile`).
- `backend/scripts/e2e-mongo.ts` — orkiestrator E2E: kontener Mongo + `migrate:up` + uruchomienie Playwrighta.
- `backend/docker-compose.yml` — dev: jedna usługa `mongo` + nazwany wolumen.
- `backend/src/__tests__/migration.spec.ts` — test migracji #1.
- `backend/src/__tests__/seed.spec.ts` — test seeda.

**Modyfikujemy:**
- `backend/src/services/profileStore.ts` — wnętrze profilu z FS na Mongoose (avatar nadal FS).
- `backend/src/app.ts` — `/api/health` zależny od stanu połączenia z Mongo.
- `backend/src/index.ts` — `connectDb()` przed `listen()`, graceful close.
- `backend/vitest.config.ts` — `globalSetup` + `setupFiles` + timeouty.
- `backend/src/__tests__/profileStore.spec.ts` — testy przeniesione na Mongo (avatar bez zmian).
- `backend/package.json` — zależności (`mongoose`, `migrate-mongo`, `@testcontainers/mongodb`) + skrypty.
- `backend/.env.example` — `MONGODB_URI`.
- `.github/workflows/ci.yml` — job `e2e` uruchamia orkiestrator z `backend/`.
- `README.md` — uruchomienie Mongo (dev), migracje, seed, nota o Dockerze w testach.
- `requirements.md` — link do tego planu w sekcji 2.4.

**Bez zmian:** `backend/src/routes/profile.ts`, `backend/src/schemas/profile.ts`, `backend/src/types/profile.ts`, `backend/src/middleware/errorHandler.ts`, `backend/src/__tests__/api.spec.ts` (działa bez zmian — patrz Task 4), `backend/src/__tests__/profileSchema.spec.ts`, `backend/src/__tests__/health.spec.ts`, cały `frontend/` (w tym specy E2E).

---

## Task 1: Zależności, model, połączenie, infrastruktura testów (Testcontainers)

Cel: zainstalować zależności i postawić infrastrukturę, dzięki której kolejne zadania mogą pisać testy na realnej bazie. Na końcu — test sanity, który dowodzi, że kontener + model + połączenie działają.

**Files:**
- Modify: `backend/package.json` (zależności)
- Create: `backend/src/models/Profile.ts`
- Create: `backend/src/db/connection.ts`
- Create: `backend/src/__tests__/setup/mongo-global-setup.ts`
- Create: `backend/src/__tests__/setup/mongo-test-setup.ts`
- Modify: `backend/vitest.config.ts`
- Test: `backend/src/__tests__/model.spec.ts` (sanity, tymczasowy)

- [ ] **Step 1: Zainstaluj zależności**

Run (w katalogu `backend/`):
```bash
npm install mongoose migrate-mongo
npm install -D @testcontainers/mongodb
```
Oczekiwane: `mongoose` i `migrate-mongo` w `dependencies`, `@testcontainers/mongodb` w `devDependencies`; zaktualizowany `package-lock.json`.

> `migrate-mongo` jest w `dependencies` (nie dev), bo migracje muszą być uruchamialne w artefakcie przy deployu (Etap 5). `@testcontainers/mongodb` jest tylko do testów.

- [ ] **Step 2: Utwórz model Mongoose**

Create `backend/src/models/Profile.ts`:
```ts
import mongoose from 'mongoose'

export const PROFILE_ID = 'profile'

export interface ProfileDoc {
  _id: string
  firstName: string
  lastName: string
  email: string
  aboutMe: string
  avatarUrl: string
}

const profileSchema = new mongoose.Schema<ProfileDoc>(
  {
    _id: { type: String, default: PROFILE_ID },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    email: { type: String, default: '' },
    aboutMe: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
  },
  // versionKey:false → bez __v; autoIndex:false → indeksy nie budują się przy starcie
  // (dobra praktyka prod; singleton i tak nie potrzebuje indeksów wtórnych).
  { versionKey: false, autoIndex: false, collection: 'profiles' },
)

// `?? model(...)` chroni przed OverwriteModelError przy wielokrotnym imporcie w testach.
export const ProfileModel =
  (mongoose.models.Profile as mongoose.Model<ProfileDoc>) ??
  mongoose.model<ProfileDoc>('Profile', profileSchema)
```

- [ ] **Step 3: Utwórz moduł połączenia**

Create `backend/src/db/connection.ts`:
```ts
import mongoose from 'mongoose'

const DB_NAME = 'teamable'

export async function connectDb(uri: string | undefined = process.env.MONGODB_URI): Promise<void> {
  if (!uri) throw new Error('MONGODB_URI is not set')
  if (mongoose.connection.readyState === 1) return
  await mongoose.connect(uri, { dbName: DB_NAME })
}

export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState === 0) return
  await mongoose.disconnect()
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1
}
```

- [ ] **Step 4: Utwórz Vitest globalSetup (kontener Mongo)**

Create `backend/src/__tests__/setup/mongo-global-setup.ts`:
```ts
import { MongoDBContainer, type StartedMongoDBContainer } from '@testcontainers/mongodb'
import type { GlobalSetupContext } from 'vitest/node'

let container: StartedMongoDBContainer

export default async function setup({ provide }: GlobalSetupContext) {
  container = await new MongoDBContainer('mongo:7').start()
  // API: getConnectionString() w aktualnym @testcontainers/mongodb.
  // (W niektórych wersjach getter `container.connectionString` — zweryfikuj w zainstalowanej wersji.)
  provide('MONGODB_URI', container.getConnectionString())

  return async () => {
    await container.stop()
  }
}

declare module 'vitest' {
  interface ProvidedContext {
    MONGODB_URI: string
  }
}
```

- [ ] **Step 5: Utwórz Vitest setupFile (połączenie + reset)**

Create `backend/src/__tests__/setup/mongo-test-setup.ts`:
```ts
import { beforeAll, afterAll, beforeEach, inject } from 'vitest'
import { connectDb, disconnectDb } from '../../db/connection.js'
import { ProfileModel } from '../../models/Profile.js'

beforeAll(async () => {
  await connectDb(inject('MONGODB_URI'))
})

afterAll(async () => {
  await disconnectDb()
})

// Każdy test startuje z pustą kolekcją (izolacja stanu profilu).
beforeEach(async () => {
  await ProfileModel.deleteMany({})
})
```

- [ ] **Step 6: Podłącz setup w vitest.config**

Replace `backend/vitest.config.ts` with:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./src/__tests__/setup/mongo-global-setup.ts'],
    setupFiles: ['./src/__tests__/setup/mongo-test-setup.ts'],
    // Start kontenera (pierwszy pull obrazu) bywa wolny.
    testTimeout: 30000,
    hookTimeout: 120000,
  },
})
```

- [ ] **Step 7: Napisz test sanity (failing first)**

Create `backend/src/__tests__/model.spec.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { ProfileModel, PROFILE_ID } from '../models/Profile.js'

describe('ProfileModel (sanity)', () => {
  it('zapisuje i odczytuje dokument-singleton w realnej bazie', async () => {
    await ProfileModel.create({ firstName: 'Test' })
    const doc = await ProfileModel.findById(PROFILE_ID).lean<{ _id: string; firstName: string }>().exec()
    expect(doc?._id).toBe(PROFILE_ID)
    expect(doc?.firstName).toBe('Test')
  })
})
```

- [ ] **Step 8: Uruchom test sanity (oczekiwany PASS, ale dowodzi działania infry)**

Run: `npm test -- model.spec` (w `backend/`, Docker musi działać)
Expected: PASS. Jeśli FAIL na `globalSetup` → sprawdź, czy Docker działa. Jeśli FAIL na `getConnectionString` → użyj `container.connectionString` (patrz nota w Step 4).

- [ ] **Step 9: Uruchom całość, by potwierdzić brak regresji**

Run: `npm test` (w `backend/`)
Expected: PASS — istniejące testy FS (`api.spec`, `profileStore.spec`, `health.spec`, `profileSchema.spec`) nadal przechodzą (store jeszcze plikowy; kontener działa „obok").

- [ ] **Step 10: Usuń test sanity i zacommituj**

Run: `rm src/__tests__/model.spec.ts`
```bash
git add backend/package.json backend/package-lock.json \
  backend/src/models/Profile.ts backend/src/db/connection.ts \
  backend/src/__tests__/setup backend/vitest.config.ts
git commit -m "feat(backend): add mongoose model, connection, and testcontainers infra"
```

---

## Task 2: Przepisz `profileStore` na MongoDB (avatar nadal FS)

**Files:**
- Modify: `backend/src/services/profileStore.ts`
- Test: `backend/src/__tests__/profileStore.spec.ts`

- [ ] **Step 1: Przepisz testy `profileStore` na Mongo (failing first)**

Replace `backend/src/__tests__/profileStore.spec.ts` with:
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

// Profil resetuje współdzielony setup (deleteMany). Tu izolujemy katalog avatara.
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

describe('profileStore (MongoDB)', () => {
  it('readProfile zwraca pusty profil, gdy brak dokumentu (FR-9)', async () => {
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

  it('deleteProfile czyści dokument + plik i jest idempotentny (FR-13)', async () => {
    await writeProfile(input)
    await saveAvatar(Buffer.from('img'), 'png')
    await deleteProfile()
    expect(await readProfile()).toEqual(EMPTY_PROFILE)
    expect(await findAvatarPath()).toBeNull()
    await expect(deleteProfile()).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Uruchom testy — oczekiwany FAIL**

Run: `npm test -- profileStore.spec` (w `backend/`)
Expected: FAIL — store nadal czyta/zapisuje plik JSON, więc `readProfile` po `writeProfile` nie odzwierciedla bazy (lub dane przeciekają między testami przez brak resetu pliku).

- [ ] **Step 3: Przepisz `profileStore` na Mongo**

Replace `backend/src/services/profileStore.ts` with:
```ts
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Profile } from '../types/profile.js'
import { EMPTY_PROFILE } from '../types/profile.js'
import type { ProfileInput } from '../schemas/profile.js'
import { ProfileModel, PROFILE_ID, type ProfileDoc } from '../models/Profile.js'

// --- Avatar nadal na dysku (jak Etap 2) ---
const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_DATA_DIR = path.resolve(moduleDir, '../../data')
function dataDir(): string {
  return process.env.PROFILE_DATA_DIR || DEFAULT_DATA_DIR
}
const uploadsDir = () => path.join(dataDir(), 'uploads')

// --- Mapowanie dokument Mongo -> kontrakt Profile (bez _id) ---
function toProfile(doc: ProfileDoc | null): Profile {
  if (!doc) return { ...EMPTY_PROFILE }
  return {
    firstName: doc.firstName,
    lastName: doc.lastName,
    email: doc.email,
    aboutMe: doc.aboutMe,
    avatarUrl: doc.avatarUrl,
  }
}

export async function readProfile(): Promise<Profile> {
  const doc = await ProfileModel.findById(PROFILE_ID).lean<ProfileDoc | null>().exec()
  return toProfile(doc)
}

export async function writeProfile(input: ProfileInput): Promise<Profile> {
  // $set tylko pól tekstowych → avatarUrl nietknięty (FR-8). Atomowość = jeden findByIdAndUpdate.
  const doc = await ProfileModel.findByIdAndUpdate(
    PROFILE_ID,
    { $set: { ...input } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
    .lean<ProfileDoc | null>()
    .exec()
  return toProfile(doc)
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

  // ?v= cache-busting (jak Etap 2); avatarUrl trzymany teraz w dokumencie.
  const avatarUrl = `/api/profile/avatar?v=${Date.now()}`
  await ProfileModel.findByIdAndUpdate(
    PROFILE_ID,
    { $set: { avatarUrl } },
    { upsert: true, setDefaultsOnInsert: true },
  ).exec()
  return avatarUrl
}

export async function deleteProfile(): Promise<void> {
  await ProfileModel.deleteOne({ _id: PROFILE_ID }).exec()
  await fs.rm(uploadsDir(), { recursive: true, force: true })
}
```

- [ ] **Step 4: Uruchom testy — oczekiwany PASS**

Run: `npm test -- profileStore.spec` (w `backend/`)
Expected: PASS (wszystkie 6 testów).

- [ ] **Step 5: Type-check**

Run: `npm run type-check` (w `backend/`)
Expected: brak błędów. Jeśli `.lean<ProfileDoc | null>()` zgłosi problem typów, użyj `.lean<ProfileDoc>()` i zawęź `toProfile` przez `doc ?? null`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/profileStore.ts backend/src/__tests__/profileStore.spec.ts
git commit -m "feat(backend): persist profile in mongodb behind the profileStore seam"
```

---

## Task 3: `/api/health` zależny od stanu połączenia + bootstrap

**Files:**
- Modify: `backend/src/app.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/src/__tests__/health.spec.ts` (pozostaje bez zmian — patrz Step 3)

- [ ] **Step 1: Zaktualizuj `/api/health`**

In `backend/src/app.ts`, dodaj import i zmień handler health:
```ts
import express from 'express'
import cors from 'cors'
import { profileRouter } from './routes/profile.js'
import { errorHandler } from './middleware/errorHandler.js'
import { isDbConnected } from './db/connection.js'

export function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    if (isDbConnected()) res.json({ status: 'ok' })
    else res.status(503).json({ status: 'down' })
  })

  app.use('/api/profile', profileRouter)

  // Error-middleware must be registered last.
  app.use(errorHandler)

  return app
}
```

- [ ] **Step 2: Zaktualizuj bootstrap (`index.ts`)**

Replace `backend/src/index.ts` with:
```ts
import { createApp } from './app.js'
import { connectDb, disconnectDb } from './db/connection.js'

const port = Number(process.env.PORT ?? 3001)

async function main() {
  await connectDb()
  const server = createApp().listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`)
  })

  const shutdown = () => {
    server.close(() => {
      void disconnectDb().finally(() => process.exit(0))
    })
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  console.error('Failed to start backend:', err)
  process.exit(1)
})
```

- [ ] **Step 3: Uruchom test health — oczekiwany PASS**

`health.spec.ts` nie wymaga zmian: współdzielony setup łączy Mongoose, więc `isDbConnected()` → `true` → `{ status: 'ok' }`.

Run: `npm test -- health.spec` (w `backend/`)
Expected: PASS.

- [ ] **Step 4: Type-check i commit**

Run: `npm run type-check` (w `backend/`) → brak błędów.
```bash
git add backend/src/app.ts backend/src/index.ts
git commit -m "feat(backend): health reports db connection state, connect before listen"
```

---

## Task 4: Potwierdź zielone testy integracyjne API (bez zmian kodu testu)

`api.spec.ts` opisuje zachowanie kontraktowe identyczne jak w Etapie 2 (czysty stan → pusty profil, whitelist, avatar, błędy). Po podmianie store na Mongo i resecie kolekcji we współdzielonym setupie powinien przejść **bez modyfikacji**. To zadanie to weryfikacja, nie zmiana.

**Files:**
- Test: `backend/src/__tests__/api.spec.ts` (uruchamiany, nie modyfikowany)

- [ ] **Step 1: Uruchom pełny zestaw integracyjny API**

Run: `npm run test:integration` (w `backend/`)
Expected: PASS — wszystkie scenariusze (`GET` pusty, `PUT` poprawny/zły email/whitelist/brak pola, `DELETE` idempotentny, avatar `POST`/`GET`/404/400/413, kontrakt pól `Profile`).

- [ ] **Step 2: Uruchom CAŁY zestaw backendu**

Run: `npm test` (w `backend/`)
Expected: PASS (`api`, `profileStore`, `health`, `profileSchema`).
Jeśli `api.spec.ts` mimo wszystko czerwony przez przeciekanie stanu profilu — to znak, że współdzielony `beforeEach` (deleteMany) nie objął pliku; potwierdź, że `vitest.config.ts` ma `setupFiles` z Task 1. **Nie** dopisuj resetu profilu w `api.spec.ts`.

- [ ] **Step 3: Commit (jeśli cokolwiek dotykane, np. drobny lint)**

Jeśli nie było zmian plików — pomiń commit. W innym wypadku:
```bash
git add backend/src/__tests__/api.spec.ts
git commit -m "test(backend): confirm api integration suite green on mongodb"
```

---

## Task 5: Migracja #1 — import legacy `profile.json` (migrate-mongo)

**Files:**
- Create: `backend/migrations/20260611120000-import-legacy-profile.cjs`
- Create: `backend/scripts/migrate.cjs`
- Test: `backend/src/__tests__/migration.spec.ts`
- Modify: `backend/package.json` (skrypty migrate:*)

- [ ] **Step 1: Napisz test migracji (failing first)**

Create `backend/src/__tests__/migration.spec.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'node:module'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import mongoose from 'mongoose'

const require = createRequire(import.meta.url)
const migration = require('../../migrations/20260611120000-import-legacy-profile.cjs')

const PROFILE_ID = 'profile'
let legacyDir: string

beforeEach(async () => {
  legacyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'teamable-legacy-'))
  process.env.LEGACY_PROFILE_DIR = legacyDir
})

afterEach(async () => {
  delete process.env.LEGACY_PROFILE_DIR
  await fs.rm(legacyDir, { recursive: true, force: true })
})

describe('migration: import-legacy-profile', () => {
  it('up jest no-op, gdy brak legacy profile.json (bezpieczne na świeżej bazie/CI)', async () => {
    await migration.up(mongoose.connection.db)
    const doc = await mongoose.connection.db.collection('profiles').findOne({ _id: PROFILE_ID })
    expect(doc).toBeNull()
  })

  it('up importuje legacy profile.json, jest idempotentne; down usuwa', async () => {
    const legacy = {
      firstName: 'Stary',
      lastName: 'Profil',
      email: 'stary@example.com',
      aboutMe: 'z pliku',
      avatarUrl: '/api/profile/avatar?v=1',
    }
    await fs.writeFile(path.join(legacyDir, 'profile.json'), JSON.stringify(legacy), 'utf8')

    await migration.up(mongoose.connection.db)
    await migration.up(mongoose.connection.db) // idempotentne — nie duplikuje
    const docs = await mongoose.connection.db
      .collection('profiles')
      .find({ _id: PROFILE_ID })
      .toArray()
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject(legacy)

    await migration.down(mongoose.connection.db)
    const after = await mongoose.connection.db.collection('profiles').findOne({ _id: PROFILE_ID })
    expect(after).toBeNull()
  })
})
```

- [ ] **Step 2: Uruchom test — oczekiwany FAIL**

Run: `npm test -- migration.spec` (w `backend/`)
Expected: FAIL — plik migracji jeszcze nie istnieje (`Cannot find module ...-import-legacy-profile.cjs`).

- [ ] **Step 3: Napisz migrację #1**

Create `backend/migrations/20260611120000-import-legacy-profile.cjs`:
```js
// Migracja #1 (Etap 3): jednorazowy import profilu z legacy pliku Etapu 2
// (backend/data/profile.json) do kolekcji `profiles`. Idempotentna i bezpieczna
// na świeżej bazie (brak pliku -> no-op).
const { promises: fs } = require('node:fs')
const path = require('node:path')

const PROFILE_ID = 'profile'

function legacyPath() {
  const dir = process.env.LEGACY_PROFILE_DIR || path.resolve(process.cwd(), 'data')
  return path.join(dir, 'profile.json')
}

module.exports = {
  async up(db) {
    const existing = await db.collection('profiles').findOne({ _id: PROFILE_ID })
    if (existing) return // już zaimportowane — idempotencja

    let raw
    try {
      raw = await fs.readFile(legacyPath(), 'utf8')
    } catch {
      return // brak legacy pliku — nic do importu (fresh/CI)
    }

    const data = JSON.parse(raw)
    await db.collection('profiles').insertOne({
      _id: PROFILE_ID,
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      email: data.email ?? '',
      aboutMe: data.aboutMe ?? '',
      avatarUrl: data.avatarUrl ?? '',
    })
  },

  async down(db) {
    await db.collection('profiles').deleteOne({ _id: PROFILE_ID })
  },
}
```

- [ ] **Step 4: Uruchom test — oczekiwany PASS**

Run: `npm test -- migration.spec` (w `backend/`)
Expected: PASS (oba testy).

- [ ] **Step 5: Napisz programowy runner migrate-mongo**

Create `backend/scripts/migrate.cjs`:
```js
// Programowy runner migrate-mongo (CommonJS, bez TS/ESM) — izoluje migracje od
// ESM-owej aplikacji. Użycie: node scripts/migrate.cjs <up|down|status>
const { config, database, up, down, status } = require('migrate-mongo')

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set')
  process.exit(1)
}

config.set({
  mongodb: {
    url: MONGODB_URI,
    databaseName: 'teamable',
    options: {},
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  lockCollectionName: 'changelog_lock',
  lockTtl: 0,
  migrationFileExtension: '.cjs',
  useFileHash: false,
  moduleSystem: 'commonjs',
})

const cmd = process.argv[2]

async function run() {
  const { db, client } = await database.connect()
  try {
    if (cmd === 'up') {
      const migrated = await up(db, client)
      migrated.forEach((f) => console.log('UP  ', f))
    } else if (cmd === 'down') {
      const reverted = await down(db, client)
      reverted.forEach((f) => console.log('DOWN', f))
    } else if (cmd === 'status') {
      console.table(await status(db))
    } else {
      console.error('usage: node scripts/migrate.cjs <up|down|status>')
      process.exitCode = 1
    }
  } finally {
    await client.close()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 6: Dodaj skrypty migrate:* do package.json**

In `backend/package.json`, w `"scripts"` dodaj:
```json
    "migrate:up": "node scripts/migrate.cjs up",
    "migrate:down": "node scripts/migrate.cjs down",
    "migrate:status": "node scripts/migrate.cjs status",
```

- [ ] **Step 7: Zweryfikuj runner przeciw lokalnej bazie (opcjonalnie, wymaga dev Mongo)**

Jeśli dostępny lokalny Mongo (Task 8): `docker compose up -d` w `backend/`, potem:
Run: `MONGODB_URI=mongodb://localhost:27017 npm run migrate:status`
Expected: tabela ze statusem migracji (PENDING dla `20260611120000-import-legacy-profile`).
Jeśli dev Mongo niedostępny, pomiń — runner jest pokryty pośrednio przez E2E (Task 9).

- [ ] **Step 8: Commit**

```bash
git add backend/migrations backend/scripts/migrate.cjs \
  backend/src/__tests__/migration.spec.ts backend/package.json
git commit -m "feat(backend): migrate-mongo runner and migration importing legacy profile.json"
```

---

## Task 6: Seed danych

**Files:**
- Create: `backend/src/services/seedProfile.ts`
- Create: `backend/scripts/seed.ts`
- Test: `backend/src/__tests__/seed.spec.ts`
- Modify: `backend/package.json` (skrypt seed)

- [ ] **Step 1: Napisz test seeda (failing first)**

Create `backend/src/__tests__/seed.spec.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { seedDemoProfile, DEMO_PROFILE } from '../services/seedProfile.js'
import { readProfile } from '../services/profileStore.js'

describe('seedDemoProfile', () => {
  it('wstawia profil demo i jest idempotentny', async () => {
    await seedDemoProfile()
    await seedDemoProfile()
    const profile = await readProfile()
    expect(profile).toMatchObject(DEMO_PROFILE)
    expect(profile.avatarUrl).toBe('')
  })
})
```

- [ ] **Step 2: Uruchom test — oczekiwany FAIL**

Run: `npm test -- seed.spec` (w `backend/`)
Expected: FAIL — `../services/seedProfile.js` nie istnieje.

- [ ] **Step 3: Napisz logikę seeda**

Create `backend/src/services/seedProfile.ts`:
```ts
import { ProfileModel, PROFILE_ID } from '../models/Profile.js'

export const DEMO_PROFILE = {
  firstName: 'Jan',
  lastName: 'Kowalski',
  email: 'jan@example.com',
  aboutMe: 'Przykładowy profil demo (seed).',
}

// Idempotentny upsert profilu demo. Zakłada aktywne połączenie z bazą.
export async function seedDemoProfile(): Promise<void> {
  await ProfileModel.findByIdAndUpdate(
    PROFILE_ID,
    { $set: { ...DEMO_PROFILE } },
    { upsert: true, setDefaultsOnInsert: true },
  ).exec()
}
```

- [ ] **Step 4: Uruchom test — oczekiwany PASS**

Run: `npm test -- seed.spec` (w `backend/`)
Expected: PASS.

- [ ] **Step 5: Napisz skrypt seeda**

Create `backend/scripts/seed.ts`:
```ts
import { connectDb, disconnectDb } from '../src/db/connection.js'
import { seedDemoProfile } from '../src/services/seedProfile.js'

async function main() {
  await connectDb()
  await seedDemoProfile()
  console.log('Seeded demo profile.')
  await disconnectDb()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 6: Dodaj skrypt seed do package.json**

In `backend/package.json`, w `"scripts"` dodaj:
```json
    "seed": "tsx scripts/seed.ts",
```

- [ ] **Step 7: Type-check i commit**

Run: `npm run type-check` (w `backend/`) → brak błędów.
```bash
git add backend/src/services/seedProfile.ts backend/scripts/seed.ts \
  backend/src/__tests__/seed.spec.ts backend/package.json
git commit -m "feat(backend): idempotent demo-profile seed (service + script)"
```

---

## Task 7: Dev MongoDB przez docker-compose + konfiguracja env

**Files:**
- Create: `backend/docker-compose.yml`
- Modify: `backend/.env.example`

- [ ] **Step 1: Utwórz docker-compose (tylko Mongo)**

Create `backend/docker-compose.yml`:
```yaml
# Dev: lokalna baza MongoDB dla backendu. Pełny stack (konteneryzacja
# aplikacji) dopiero Etap 4. Uruchomienie: `docker compose up -d`.
services:
  mongo:
    image: mongo:7
    ports:
      - '27017:27017'
    volumes:
      - teamable-mongo-data:/data/db

volumes:
  teamable-mongo-data:
```

- [ ] **Step 2: Zaktualizuj `.env.example`**

Replace `backend/.env.example` with:
```bash
# Port serwera HTTP (domyślnie 3001)
PORT=3001
# Katalog danych: uploads/ ze zdjęciem avatara (domyślnie ./data)
PROFILE_DATA_DIR=
# Połączenie z MongoDB (dev: docker compose up -d)
MONGODB_URI=mongodb://localhost:27017
```

- [ ] **Step 3: Weryfikacja smoke (wymaga Dockera)**

Run (w `backend/`):
```bash
docker compose up -d
MONGODB_URI=mongodb://localhost:27017 npm run migrate:up
MONGODB_URI=mongodb://localhost:27017 npm run seed
MONGODB_URI=mongodb://localhost:27017 PORT=3001 npm run dev
```
Expected: `migrate:up` stosuje migrację (lub no-op, jeśli już zastosowana), `seed` wstawia profil demo, `dev` wypisuje „Backend listening…". Zatrzymaj `dev` (Ctrl+C) i `docker compose down`.

- [ ] **Step 4: Commit**

```bash
git add backend/docker-compose.yml backend/.env.example
git commit -m "chore(backend): dev docker-compose for mongo and MONGODB_URI in env example"
```

---

## Task 8: Orkiestrator E2E (Testcontainers + migrate:up + Playwright)

Backend uruchamiany przez Playwright (`start:e2e`) potrzebuje teraz `MONGODB_URI`. Orkiestrator startuje kontener i `migrate:up`, ustawia env, a potem odpala Playwrighta — env istnieje, zanim Playwright wystartuje `webServer`, więc backend je dziedziczy (niezależnie od kolejności globalSetup/webServer).

**Files:**
- Create: `backend/scripts/e2e-mongo.ts`
- Modify: `backend/package.json` (skrypt test:e2e)
- Bez zmian: `frontend/playwright.config.ts`, `backend/package.json:start:e2e` (dziedziczy `MONGODB_URI`), specy E2E.

- [ ] **Step 1: Napisz orkiestrator**

Create `backend/scripts/e2e-mongo.ts`:
```ts
import os from 'node:os'
import path from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { MongoDBContainer } from '@testcontainers/mongodb'

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', env })
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`)),
    )
    child.on('error', reject)
  })
}

async function main() {
  const container = await new MongoDBContainer('mongo:7').start()
  // Pusty katalog legacy → migracja #1 to no-op (nie importujemy danych dev do E2E).
  const legacyDir = await mkdtemp(path.join(os.tmpdir(), 'teamable-e2e-legacy-'))
  const env = {
    ...process.env,
    MONGODB_URI: container.getConnectionString(),
    LEGACY_PROFILE_DIR: legacyDir,
  }

  try {
    await run('node', ['scripts/migrate.cjs', 'up'], env)
    // Playwright (frontend) startuje backend `start:e2e` (dziedziczy MONGODB_URI) + preview.
    await run('npm', ['--prefix', '../frontend', 'run', 'test:e2e'], env)
  } finally {
    await container.stop()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Dodaj skrypt test:e2e (backend) do package.json**

In `backend/package.json`, w `"scripts"` dodaj:
```json
    "test:e2e": "tsx scripts/e2e-mongo.ts",
```

- [ ] **Step 3: Uruchom E2E lokalnie (wymaga Dockera + przeglądarki Playwright)**

Jeśli przeglądarki nieobecne: `npm --prefix ../frontend exec playwright install chromium` (jednorazowo).
Run (w `backend/`): `npm run test:e2e`
Expected: kontener startuje, `migrate:up` (no-op), Playwright buduje frontend, startuje backend (:3101) i preview (:4173), scenariusze przechodzą zielono; na końcu kontener jest zatrzymany. Brakujące przeglądarki → komunikat Playwrighta o `playwright install`.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/e2e-mongo.ts backend/package.json
git commit -m "test(e2e): orchestrate mongo testcontainer and migrate:up before playwright"
```

---

## Task 9: CI — job e2e uruchamia orkiestrator, backend-dist z migracjami

Job `backend` już odpala `npm run test:coverage`, który po Task 1 startuje Testcontainers (Docker jest na runnerach GitHub-hosted) — testy bez zmian. Rozszerzamy artefakt `backend-dist` o migracje + runner (pod deploy w Etapie 5) i zmieniamy job `e2e`, by szedł przez orkiestrator backendu.

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Dołącz migracje i runner do artefaktu backend-dist**

In `.github/workflows/ci.yml`, w jobie `backend`, w kroku „Upload backend artifact" rozszerz `path` o migracje i runner (deploy w Etapie 5 musi móc odpalić `migrate:up`):
```yaml
      - name: Upload backend artifact
        uses: actions/upload-artifact@v4
        with:
          name: backend-dist
          path: |
            backend/dist
            backend/package.json
            backend/package-lock.json
            backend/migrations
            backend/scripts/migrate.cjs
```

- [ ] **Step 2: Zmień krok „E2E tests" w jobie e2e**

In `.github/workflows/ci.yml`, w jobie `e2e` zamień blok kroku „E2E tests":
```yaml
      # Orkiestrator (backend) podnosi Mongo (Testcontainers), uruchamia migrate:up,
      # a następnie Playwrighta (frontend), który startuje backend (:3101, temp
      # PROFILE_DATA_DIR, dziedziczone MONGODB_URI) i preview, czekając na /api/health.
      - name: E2E tests
        run: npm run test:e2e
        working-directory: backend
```
(usuwając poprzedni krok z `working-directory: frontend` i jego komentarz).

- [ ] **Step 3: Walidacja składni workflow (lokalnie, jeśli dostępny `act`/`yamllint` — opcjonalnie)**

Run (opcjonalnie): `npx yaml-lint .github/workflows/ci.yml` lub wizualny przegląd wcięć.
Expected: poprawny YAML; krok e2e wskazuje `working-directory: backend`; `backend-dist` zawiera `migrations` + `scripts/migrate.cjs`.

- [ ] **Step 4: Commit (właściwa weryfikacja nastąpi przez CI po pushu)**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: e2e via backend orchestrator and ship migrations in backend-dist"
```

---

## Task 10: Dokumentacja (README + link planu w requirements)

**Files:**
- Modify: `README.md`
- Modify: `requirements.md`

- [ ] **Step 1: Dodaj sekcję MongoDB do README**

In `README.md`, dodaj sekcję (umieść przy instrukcjach backendu; dopasuj nagłówek do istniejącej struktury):
```markdown
## Backend — MongoDB (Etap 3)

Backend przechowuje profil w MongoDB (zdjęcie nadal jako plik na dysku).

### Lokalna baza (dev)
```bash
cd backend
docker compose up -d                 # MongoDB na localhost:27017 (nazwany wolumen)
export MONGODB_URI=mongodb://localhost:27017
npm run migrate:up                   # zastosuj migracje (import legacy profile.json, jeśli jest)
npm run seed                         # (opcjonalnie) profil demo
npm run dev                          # backend na :3001
```

### Testy
- `npm test` w `backend/` wymaga **działającego Dockera** — testy integracyjne podnoszą realny MongoDB przez Testcontainers.
- `npm run test:e2e` w `backend/` uruchamia pełny full-stack E2E: kontener Mongo + `migrate:up` + Playwright (frontend + backend).

### Migracje
- `npm run migrate:up` / `migrate:down` / `migrate:status` (wymaga `MONGODB_URI`).
```

- [ ] **Step 2: Podlinkuj plan w requirements.md (sekcja 2.4)**

In `requirements.md`, w tabeli 2.4 zamień komórkę planu Etapu 3:
```markdown
| 3 — MongoDB | [2026-06-11-etap3-mongodb-design.md](docs/superpowers/specs/2026-06-11-etap3-mongodb-design.md) | [2026-06-11-etap3-mongodb.md](docs/superpowers/plans/2026-06-11-etap3-mongodb.md) |
```

- [ ] **Step 3: Odnotuj zmianę trwałości w requirements (kontrakt 5.4 + FR-8)**

In `requirements.md`, w sekcji **5.4**, po istniejącej nocie „Zmiana kontraktu (Etap 2)…" dodaj:
```markdown
>
> **Trwałość (Etap 3):** źródłem prawdy profilu jest teraz **dokument MongoDB** (kolekcja `profiles`, singleton `_id:'profile'`). Kształt `Profile` i semantyka `avatarUrl` bez zmian; zdjęcie nadal plikiem na dysku, w dokumencie trzymany jest tylko `avatarUrl`. Mechanizm trwałości FR-8 (plik JSON) zostaje **zastąpiony przez MongoDB** — analogicznie do tego, jak FR-8 zastąpił `localStorage` z FR-7.
```

In `requirements.md`, **pod tabelą sekcji 4.1** (po wierszu FR-13, przed `---`) dodaj notę:
```markdown
> **Etap 3:** mechanizm trwałości z FR-8 (plik JSON) zostaje zastąpiony przez **MongoDB**; kryteria akceptacji FR-8…FR-13 pozostają w mocy (zmienia się tylko backend trwałości). Szczegóły: [spec Etapu 3](docs/superpowers/specs/2026-06-11-etap3-mongodb-design.md).
```

- [ ] **Step 4: Commit**

```bash
git add README.md requirements.md
git commit -m "docs(etap3): mongodb run/test instructions, plan link, persistence note"
```

---

## Task 11: Pełna weryfikacja end-to-end (Definition of Done)

**Files:** brak (weryfikacja)

- [ ] **Step 1: Lint + format + type-check backend**

Run (w `backend/`): `npm run lint && npx prettier --check src && npm run type-check`
Expected: czysto.

- [ ] **Step 2: Pełne testy backendu + coverage**

Run (w `backend/`): `npm run test:coverage`
Expected: PASS; w raporcie m.in. `profileStore`, `api`, `migration`, `seed`, `health`, `profileSchema`.

- [ ] **Step 3: Full-stack E2E**

Run (w `backend/`): `npm run test:e2e`
Expected: PASS (scenariusze profilu, walidacji email, uploadu, „Anuluj", pusty profil na czystym stanie).

- [ ] **Step 4: Frontend bez regresji**

Run (w `frontend/`): `npm run test:unit -- --run`
Expected: PASS (kontrakt API niezmieniony).

- [ ] **Step 5: Sprawdź DoD specu**

Otwórz [spec Etapu 3 §11](../specs/2026-06-11-etap3-mongodb-design.md) i potwierdź każdy punkt DoD. Zaznacz checkboxy w specu, jeśli prowadzicie je jako żywą listę.

- [ ] **Step 6: Push i obserwacja CI**

```bash
git push
```
Expected: joby `frontend`, `backend`, `e2e` zielone (e2e używa Dockera/Testcontainers na runnerze).

---

## Notatki realizacyjne

- **Docker wymagany** do testów backendu i E2E (Testcontainers). To świadoma zależność testowa Etapu 3 — nie konteneryzacja aplikacji (Etap 4).
- **`getConnectionString()` vs `connectionString`** — użyto metody; przy innej wersji `@testcontainers/mongodb` zweryfikuj akcesor (nota w Task 1, Step 4).
- **Typy `migrate-mongo`** — runner jest w CommonJS (`.cjs`, `require`), więc nie zależy od jakości typów TS biblioteki.
- **`api.spec.ts` celowo bez zmian** — dowód, że kontrakt API jest stabilny przy podmianie trwałości (Task 4).
- **Reset stanu w testach:** profil — `deleteMany` we współdzielonym setupie; avatar — temp `PROFILE_DATA_DIR` per test; E2E — `DELETE /api/profile` per test (mechanizm z Etapu 2, bez zmian).
- **`inject('MONGODB_URI')` w setupFile** — wartość pochodzi z `provide(...)` w globalSetup (oficjalny wzorzec Vitest + Testcontainers). Wywoływane wewnątrz `beforeAll` (kontekst workera), więc jest dostępne. Gdyby zwracało `undefined`, fallback: wczytaj URI w `beforeAll` przez `inject` na początku każdego pliku DB-testu zamiast w setupFile.
- **backend job a Docker:** `npm run test:coverage` po Task 1 wymaga Dockera (Testcontainers). Runnery GitHub-hosted `ubuntu-latest` mają Dockera natywnie — bez dodatkowej konfiguracji w workflow.
