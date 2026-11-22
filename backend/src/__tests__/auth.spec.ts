import { describe, it, expect } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import { createApp } from '../app.js'
import { createCredentialUser, deleteUser, findUserIdByEmail, setPassword } from '../auth/users.js'
import { signIn, createUserAndSignIn, TEST_ORIGIN, TEST_PASSWORD } from './helpers/auth.js'

const app = createApp()

const USERS = { a: 'anna@example.com', owner: 'owner@example.com' }

const db = () => mongoose.connection.db!

function signInReq(body: unknown) {
  return request(app)
    .post('/api/auth/sign-in/email')
    .set('Origin', TEST_ORIGIN)
    .send(body as object)
}

function getSession(cookie?: string) {
  const req = request(app).get('/api/auth/get-session')
  return cookie ? req.set('Cookie', cookie) : req
}

describe('Better Auth: mount i logowanie', () => {
  it('GET /api/auth/ok → 200', async () => {
    const res = await request(app).get('/api/auth/ok')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('logowanie poprawnymi danymi → 200 i ciasteczko sesji (FR-14)', async () => {
    await createCredentialUser({ email: USERS.a, password: TEST_PASSWORD })
    const res = await signInReq({ email: USERS.a, password: TEST_PASSWORD })
    expect(res.status).toBe(200)
    expect(String(res.headers['set-cookie'])).toContain('better-auth.session_token')
  })

  it('złe hasło i nieznany e-mail → 401 o tym samym kształcie', async () => {
    await createCredentialUser({ email: USERS.a, password: TEST_PASSWORD })
    const wrong = await signInReq({ email: USERS.a, password: 'zle-haslo-123' })
    const unknown = await signInReq({ email: 'nikt@example.com', password: TEST_PASSWORD })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(unknown.body).toEqual(wrong.body)
  })

  it('logowanie e-mailem w innej wielkości liter → 200', async () => {
    await createCredentialUser({ email: USERS.owner, password: TEST_PASSWORD })
    const res = await signInReq({ email: 'Owner@Example.com', password: TEST_PASSWORD })
    expect(res.status).toBe(200)
  })

  it('get-session bez ciasteczka → 200 i null', async () => {
    const res = await getSession()
    expect(res.status).toBe(200)
    expect(res.body).toBeNull()
  })

  it('sign-out unieważnia sesję (FR-16)', async () => {
    const { cookie } = await createUserAndSignIn(app, USERS.a)
    expect((await getSession(cookie)).body).not.toBeNull()
    const res = await request(app)
      .post('/api/auth/sign-out')
      .set('Cookie', cookie)
      .set('Origin', TEST_ORIGIN)
    expect(res.status).toBe(200)
    expect((await getSession(cookie)).body).toBeNull()
  })

  it('rejestracja jest wyłączona (FR-17)', async () => {
    const res = await request(app)
      .post('/api/auth/sign-up/email')
      .set('Origin', TEST_ORIGIN)
      .send({ email: 'nowy@example.com', password: TEST_PASSWORD, name: 'Nowy' })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(await db().collection('user').countDocuments()).toBe(0)
  })
})

describe('zarządzanie kontami', () => {
  it('createCredentialUser waliduje hasło (8..128) i e-mail', async () => {
    await expect(
      createCredentialUser({ email: USERS.a, password: 'x'.repeat(7) }),
    ).rejects.toThrow()
    await expect(
      createCredentialUser({ email: USERS.a, password: 'x'.repeat(129) }),
    ).rejects.toThrow()
    await expect(
      createCredentialUser({ email: 'nie-email', password: TEST_PASSWORD }),
    ).rejects.toThrow()
    expect(await db().collection('user').countDocuments()).toBe(0)
  })

  it('duplikat e-maila (inna wielkość liter) → błąd, po 1 dokumencie user/account', async () => {
    await createCredentialUser({ email: USERS.owner, password: TEST_PASSWORD })
    await expect(
      createCredentialUser({ email: ' OWNER@example.com ', password: TEST_PASSWORD }),
    ).rejects.toThrow('Użytkownik o tym e-mailu już istnieje')
    expect(await db().collection('user').countDocuments()).toBe(1)
    expect(await db().collection('account').countDocuments()).toBe(1)
  })

  it('setPassword unieważnia sesje i zmienia hasło (FR-17)', async () => {
    const { cookie } = await createUserAndSignIn(app, USERS.a)
    await setPassword(USERS.a, 'nowe-haslo-456')
    expect((await getSession(cookie)).body).toBeNull()
    expect((await signInReq({ email: USERS.a, password: 'nowe-haslo-456' })).status).toBe(200)
    expect((await signInReq({ email: USERS.a, password: TEST_PASSWORD })).status).toBe(401)
  })

  it('deleteUser usuwa konto i sesje', async () => {
    const { cookie } = await createUserAndSignIn(app, USERS.a)
    await deleteUser(USERS.a)
    expect((await signInReq({ email: USERS.a, password: TEST_PASSWORD })).status).toBe(401)
    expect((await getSession(cookie)).body).toBeNull()
    expect(await findUserIdByEmail(USERS.a)).toBeNull()
    expect(await db().collection('account').countDocuments()).toBe(0)
  })

  it('findUserIdByEmail zwraca id użytkownika', async () => {
    const { id } = await createCredentialUser({ email: USERS.a, password: TEST_PASSWORD })
    expect(await findUserIdByEmail('Anna@Example.com')).toBe(id)
    expect(await findUserIdByEmail('nikt@example.com')).toBeNull()
  })
})

describe('bezpieczeństwo', () => {
  it('SEC-B1: hasło nie jest przechowywane jawnie', async () => {
    await createCredentialUser({ email: USERS.a, password: TEST_PASSWORD })
    const account = await db().collection('account').findOne({ providerId: 'credential' })
    expect(account?.password).toBeTypeOf('string')
    expect(account?.password).not.toBe(TEST_PASSWORD)
    expect(account?.password).not.toContain(TEST_PASSWORD)
  })

  it('SEC-B2: odpowiedzi nie ujawniają hasha', async () => {
    await createCredentialUser({ email: USERS.a, password: TEST_PASSWORD })
    const { password: hash } = (await db().collection('account').findOne({}))!
    const res = await signInReq({ email: USERS.a, password: TEST_PASSWORD })
    const cookie = await signIn(app, USERS.a, TEST_PASSWORD)
    const session = await getSession(cookie)
    for (const body of [JSON.stringify(res.body), JSON.stringify(session.body)]) {
      expect(body).not.toContain('"password"')
      expect(body).not.toContain(hash)
    }
  })

  it('SEC-B3: NoSQL injection w logowaniu → 4xx bez ciasteczka', async () => {
    await createCredentialUser({ email: USERS.a, password: TEST_PASSWORD })
    for (const body of [
      { email: { $ne: null }, password: 'x' },
      { email: USERS.a, password: { $ne: null } },
    ]) {
      const res = await signInReq(body)
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
      expect(res.headers['set-cookie']).toBeUndefined()
    }
  })
})
