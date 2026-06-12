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

// Isolation note: the `profiles` collection is reset before each test by the
// shared setup (`mongo-test-setup.ts` → ProfileModel.deleteMany({})). These tests
// write to the same collection via the raw driver and rely on that shared reset —
// they intentionally do not clean `profiles` themselves.
describe('migration: import-legacy-profile', () => {
  it('up jest no-op, gdy brak legacy profile.json (bezpieczne na świeżej bazie/CI)', async () => {
    const db = mongoose.connection.db!
    await migration.up(db)
    const doc = await db.collection<{ _id: string }>('profiles').findOne({ _id: PROFILE_ID })
    expect(doc).toBeNull()
  })

  it('up importuje legacy profile.json, jest idempotentne; down usuwa', async () => {
    const db = mongoose.connection.db!
    const legacy = {
      firstName: 'Stary',
      lastName: 'Profil',
      email: 'stary@example.com',
      aboutMe: 'z pliku',
      avatarUrl: '/api/profile/avatar?v=1',
    }
    await fs.writeFile(path.join(legacyDir, 'profile.json'), JSON.stringify(legacy), 'utf8')

    await migration.up(db)
    await migration.up(db) // idempotent — no duplicate
    const docs = await db
      .collection<{ _id: string }>('profiles')
      .find({ _id: PROFILE_ID })
      .toArray()
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject(legacy)

    await migration.down(db)
    const after = await db.collection<{ _id: string }>('profiles').findOne({ _id: PROFILE_ID })
    expect(after).toBeNull()
  })
})
