import { describe, it, expect, vi, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import request from 'supertest'
import mongoose from 'mongoose'
import { createApp } from '../app.js'
import { runUserCli } from '../cli/user.js'
import { findUserIdByEmail } from '../auth/users.js'
import { ProfileModel, LEGACY_PROFILE_ID } from '../models/Profile.js'
import { readProfile } from '../services/profileStore.js'
import { seedDemoUser } from '../auth/demoUser.js'
import { signIn } from './helpers/auth.js'
import { useTempDataDir, exists } from './helpers/dataDir.js'

const app = createApp()
const dataDir = useTempDataDir('teamable-cli-')
const PASSWORD = 'haslo1234'

const log = vi.spyOn(console, 'log').mockImplementation(() => {})
const error = vi.spyOn(console, 'error').mockImplementation(() => {})
afterEach(() => {
  log.mockClear()
  error.mockClear()
})

const create = (email: string, password = PASSWORD) =>
  runUserCli(['create', '--email', email, '--password', password])
const users = () => mongoose.connection.db!.collection('user')

describe('CLI kont: create', () => {
  it('tworzy konto, które może się zalogować; profil ma e-mail kontaktowy (FR-17, FR-9)', async () => {
    expect(await create('a@x.pl')).toBe(0)
    await expect(signIn(app, 'a@x.pl', PASSWORD)).resolves.toContain('session_token')
    const id = (await findUserIdByEmail('a@x.pl'))!
    expect(await readProfile(id)).toMatchObject({ email: 'a@x.pl', firstName: '', avatarUrl: '' })
  })

  it('bez --password → kod ≠ 0 i brak konta', async () => {
    expect(await runUserCli(['create', '--email', 'a@x.pl'])).not.toBe(0)
    expect(await users().countDocuments()).toBe(0)
  })

  it('nieznana komenda → kod ≠ 0 i instrukcja użycia', async () => {
    expect(await runUserCli(['rename'])).not.toBe(0)
    expect(error.mock.calls.flat().join('\n')).toMatch(/create\|delete\|set-password/)
  })

  it('e-mail z wielkimi literami zapisuje się małymi; drugie konto z tym adresem → kod ≠ 0', async () => {
    expect(await create('Anna@X.pl')).toBe(0)
    expect(await users().findOne({}, { projection: { email: 1 } })).toMatchObject({
      email: 'anna@x.pl',
    })
    expect(await create('anna@x.pl')).not.toBe(0)
    expect(await users().countDocuments()).toBe(1)
  })

  it('przejmuje profil sprzed kont i to ogłasza', async () => {
    await ProfileModel.create({ _id: LEGACY_PROFILE_ID, firstName: 'Stary' })
    expect(await create('owner@x.pl')).toBe(0)
    expect(log.mock.calls.flat().join('\n')).toContain('Przejęto istniejący profil')
    const id = (await findUserIdByEmail('owner@x.pl'))!
    expect((await readProfile(id)).firstName).toBe('Stary')
  })

  it('istniejący demo-user nie przejmuje singletonu; robi to dopiero `create`', async () => {
    process.env.DEMO_USER_EMAIL = 'demo@x.pl'
    process.env.DEMO_USER_PASSWORD = 'demo-haslo-1'
    try {
      await ProfileModel.create({ _id: LEGACY_PROFILE_ID, firstName: 'Stary' })
      await seedDemoUser()
      expect(await ProfileModel.exists({ _id: LEGACY_PROFILE_ID })).not.toBeNull()

      await create('owner@x.pl')
      const id = (await findUserIdByEmail('owner@x.pl'))!
      expect((await readProfile(id)).firstName).toBe('Stary')
    } finally {
      delete process.env.DEMO_USER_EMAIL
      delete process.env.DEMO_USER_PASSWORD
    }
  })
})

describe('CLI kont: set-password i delete', () => {
  it('set-password: stare ciasteczko → 401, nowe hasło działa (FR-17)', async () => {
    await create('a@x.pl')
    const cookie = await signIn(app, 'a@x.pl', PASSWORD)

    expect(
      await runUserCli(['set-password', '--email', 'a@x.pl', '--password', 'nowe-haslo-9']),
    ).toBe(0)

    expect((await request(app).get('/api/profile').set('Cookie', cookie)).status).toBe(401)
    await expect(signIn(app, 'a@x.pl', 'nowe-haslo-9')).resolves.toContain('session_token')
    await expect(signIn(app, 'a@x.pl', PASSWORD)).rejects.toThrow(/401/)
  })

  it('delete: sesja → 401, brak profilu i katalogu avatara (FR-19)', async () => {
    await create('a@x.pl')
    const id = (await findUserIdByEmail('a@x.pl'))!
    const cookie = await signIn(app, 'a@x.pl', PASSWORD)
    await request(app)
      .post('/api/profile/avatar')
      .set('Cookie', cookie)
      .attach('avatar', Buffer.from('img'), { filename: 'a.png', contentType: 'image/png' })
    expect(await exists(path.join(dataDir(), 'uploads', id))).toBe(true)

    expect(await runUserCli(['delete', '--email', 'a@x.pl'])).toBe(0)

    expect((await request(app).get('/api/profile').set('Cookie', cookie)).status).toBe(401)
    expect(await ProfileModel.exists({ _id: id })).toBeNull()
    expect(await exists(path.join(dataDir(), 'uploads', id))).toBe(false)
  })

  it('delete nieistniejącego konta → kod ≠ 0', async () => {
    expect(await runUserCli(['delete', '--email', 'nikt@x.pl'])).not.toBe(0)
  })

  it('delete nie rusza danych innego użytkownika', async () => {
    await create('a@x.pl')
    await create('b@x.pl')
    const b = (await findUserIdByEmail('b@x.pl'))!
    await fs.mkdir(path.join(dataDir(), 'uploads', b), { recursive: true })

    await runUserCli(['delete', '--email', 'a@x.pl'])

    expect(await ProfileModel.exists({ _id: b })).not.toBeNull()
    expect(await exists(path.join(dataDir(), 'uploads', b))).toBe(true)
  })
})
