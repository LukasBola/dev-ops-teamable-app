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
