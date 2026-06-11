// Migration #1 (Etap 3): one-time import of legacy Etap 2 profile (backend/data/profile.json)
// into the `profiles` collection. Idempotent and safe on fresh DB (no file → no-op).
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
    if (existing) return // already imported — idempotent

    let raw
    try {
      raw = await fs.readFile(legacyPath(), 'utf8')
    } catch {
      return // no legacy file — nothing to import (fresh/CI)
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
