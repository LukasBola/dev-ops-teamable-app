import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import mongoose from 'mongoose'
import { createApp } from '../app.js'
import { seedDemoUser, DEMO_PROFILE } from '../auth/demoUser.js'
import { findUserIdByEmail } from '../auth/users.js'
import { readProfile } from '../services/profileStore.js'
import { ProfileModel, LEGACY_PROFILE_ID } from '../models/Profile.js'
import { signIn } from './helpers/auth.js'

const app = createApp()
const users = () => mongoose.connection.db!.collection('user')

beforeEach(() => {
  process.env.DEMO_USER_EMAIL = 'demo@example.com'
  process.env.DEMO_USER_PASSWORD = 'demo-haslo-1'
})

afterEach(() => {
  delete process.env.DEMO_USER_EMAIL
  delete process.env.DEMO_USER_PASSWORD
})

describe('seedDemoUser', () => {
  it('dwukrotny seed → 1 user, logowanie działa, profil = DEMO_PROFILE z e-mailem demo', async () => {
    await seedDemoUser()
    await seedDemoUser()

    expect(await users().countDocuments()).toBe(1)
    await expect(signIn(app, 'demo@example.com', 'demo-haslo-1')).resolves.toContain(
      'session_token',
    )
    const id = (await findUserIdByEmail('demo@example.com'))!
    expect(await readProfile(id)).toEqual({
      ...DEMO_PROFILE,
      email: 'demo@example.com',
      avatarUrl: '',
    })
  })

  it('zmiana DEMO_USER_PASSWORD + ponowny seed → nowe hasło działa, stare nie', async () => {
    await seedDemoUser()
    process.env.DEMO_USER_PASSWORD = 'nowe-demo-haslo'
    await seedDemoUser()

    await expect(signIn(app, 'demo@example.com', 'nowe-demo-haslo')).resolves.toContain(
      'session_token',
    )
    await expect(signIn(app, 'demo@example.com', 'demo-haslo-1')).rejects.toThrow(/401/)
  })

  it('nie dotyka profilu sprzed kont (singletonu)', async () => {
    await ProfileModel.create({ _id: LEGACY_PROFILE_ID, firstName: 'Stary' })
    await seedDemoUser()
    expect(await readProfile(LEGACY_PROFILE_ID)).toMatchObject({ firstName: 'Stary' })
  })

  it('DEMO_USER_EMAIL z wielkimi literami → 1 user małymi literami, bez duplikatu', async () => {
    process.env.DEMO_USER_EMAIL = 'Demo@Example.com'
    await seedDemoUser()
    await seedDemoUser()
    expect(
      await users()
        .find({}, { projection: { email: 1, _id: 0 } })
        .toArray(),
    ).toEqual([{ email: 'demo@example.com' }])
  })

  it.each(['DEMO_USER_EMAIL', 'DEMO_USER_PASSWORD'])('brak %s → rzuca', async (name) => {
    delete process.env[name]
    await expect(seedDemoUser()).rejects.toThrow(name)
  })
})
