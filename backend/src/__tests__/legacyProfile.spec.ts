import { describe, it, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ProfileModel, LEGACY_PROFILE_ID } from '../models/Profile.js'
import { adoptLegacyProfile } from '../services/legacyProfile.js'
import { readProfile } from '../services/profileStore.js'
import { useTempDataDir, exists } from './helpers/dataDir.js'

const dataDir = useTempDataDir('teamable-legacy-')

const legacy = {
  firstName: 'Stary',
  lastName: 'Profil',
  email: 'stary@example.com',
  aboutMe: 'sprzed kont',
  avatarUrl: '/api/profile/avatar?v=1',
}

async function seedSingleton(withAvatar: boolean) {
  await ProfileModel.create({ _id: LEGACY_PROFILE_ID, ...legacy })
  if (withAvatar) {
    await fs.mkdir(path.join(dataDir(), 'uploads'), { recursive: true })
    await fs.writeFile(path.join(dataDir(), 'uploads', 'avatar.png'), 'img')
  }
}

describe('adoptLegacyProfile', () => {
  it('przenosi singleton i avatar do konta, usuwa singleton', async () => {
    await seedSingleton(true)

    expect(await adoptLegacyProfile('u1')).toBe(true)

    const profile = await readProfile('u1')
    expect(profile).toMatchObject({ ...legacy, avatarUrl: expect.any(String) })
    expect(profile.avatarUrl).toMatch(/^\/api\/profile\/avatar\?v=\d+$/)
    expect(profile.avatarUrl).not.toBe(legacy.avatarUrl)
    expect(await exists(path.join(dataDir(), 'uploads', 'u1', 'avatar.png'))).toBe(true)
    expect(await exists(path.join(dataDir(), 'uploads', 'avatar.png'))).toBe(false)
    expect(await ProfileModel.exists({ _id: LEGACY_PROFILE_ID })).toBeNull()
  })

  it('drugie wywołanie → false i nic nie zmienia (idempotencja)', async () => {
    await seedSingleton(true)
    await adoptLegacyProfile('u1')
    const before = await readProfile('u1')

    expect(await adoptLegacyProfile('u2')).toBe(false)
    expect(await readProfile('u1')).toEqual(before)
    expect(await ProfileModel.exists({ _id: 'u2' })).toBeNull()
  })

  it('nadpisuje pusty profil nowego konta', async () => {
    await ProfileModel.create({ _id: 'u1', email: 'nowe@example.com' })
    await seedSingleton(false)
    await adoptLegacyProfile('u1')
    expect((await readProfile('u1')).firstName).toBe('Stary')
  })

  it('singleton bez pliku avatara → avatarUrl pusty (brak martwego linku)', async () => {
    await seedSingleton(false)
    await adoptLegacyProfile('u1')
    expect((await readProfile('u1')).avatarUrl).toBe('')
  })

  it('brak singletonu → false', async () => {
    expect(await adoptLegacyProfile('u1')).toBe(false)
    expect(await ProfileModel.exists({ _id: 'u1' })).toBeNull()
  })
})
