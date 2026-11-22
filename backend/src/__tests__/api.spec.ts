import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { createApp } from '../app.js'
import { EMPTY_PROFILE } from '../types/profile.js'
import { createUserAndSignIn, TEST_ORIGIN } from './helpers/auth.js'

let dataDir: string
let cookie: string
const app = createApp()

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'teamable-api-'))
  process.env.PROFILE_DATA_DIR = dataDir
  ;({ cookie } = await createUserAndSignIn(app, 'anna@example.com'))
})

afterEach(async () => {
  delete process.env.PROFILE_DATA_DIR
  await fs.rm(dataDir, { recursive: true, force: true })
})

// FR-9 (Etap 4.5): nowe konto ma pusty profil poza e-mailem kontaktowym.
const freshProfile = (email: string) => ({ ...EMPTY_PROFILE, email })
const ANNA_FRESH = freshProfile('anna@example.com')

const validBody = {
  firstName: 'Anna',
  lastName: 'Nowak',
  email: 'anna@example.com',
  aboutMe: 'Cześć!',
}

describe('GET /api/profile', () => {
  it('nowe konto: pusty profil z e-mailem kontaktowym = e-mail logowania (FR-9)', async () => {
    const res = await request(app).get('/api/profile').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body).toEqual(ANNA_FRESH)
  })

  it('test kontraktowy: odpowiedź ma dokładnie pola Profile', async () => {
    const res = await request(app).get('/api/profile').set('Cookie', cookie)
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
    const res = await request(app).put('/api/profile').set('Cookie', cookie).send(validBody)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ...validBody, avatarUrl: '' })

    const get = await request(app).get('/api/profile').set('Cookie', cookie)
    expect(get.body).toEqual({ ...validBody, avatarUrl: '' })
  })

  it('odrzuca niepoprawny email z 400 i formatem { error } (FR-12)', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Cookie', cookie)
      .send({ ...validBody, email: 'zly-email' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Niepoprawny adres email' })

    const get = await request(app).get('/api/profile').set('Cookie', cookie)
    expect(get.body).toEqual(ANNA_FRESH) // nic nie zapisano
  })

  it('akceptuje pusty email (FR-9)', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Cookie', cookie)
      .send({ ...validBody, email: '' })
    expect(res.status).toBe(200)
  })

  it('ignoruje avatarUrl i nieznane pola w body (whitelist)', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Cookie', cookie)
      .send({ ...validBody, avatarUrl: '/oszukany.png', hack: 1 })
    expect(res.status).toBe(200)
    expect(res.body.avatarUrl).toBe('')
    expect(res.body).not.toHaveProperty('hack')
  })

  it('odrzuca body bez wymaganego pola z 400', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Cookie', cookie)
      .send({ firstName: 'X' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Niepoprawne dane profilu' })
  })
})

describe('DELETE /api/profile', () => {
  it('resetuje profil do pustego i jest idempotentny (FR-13)', async () => {
    await request(app).put('/api/profile').set('Cookie', cookie).send(validBody)

    const del = await request(app).delete('/api/profile').set('Cookie', cookie)
    expect(del.status).toBe(204)

    const get = await request(app).get('/api/profile').set('Cookie', cookie)
    expect(get.body).toEqual(EMPTY_PROFILE)

    const delAgain = await request(app).delete('/api/profile').set('Cookie', cookie)
    expect(delAgain.status).toBe(204)
  })
})

describe('POST + GET /api/profile/avatar', () => {
  const png = Buffer.from('fake-png-bytes')

  it('upload obrazu zwraca avatarUrl z cache-bustingiem (FR-10)', async () => {
    const res = await request(app)
      .post('/api/profile/avatar')
      .set('Cookie', cookie)
      .attach('avatar', png, { filename: 'a.png', contentType: 'image/png' })
    expect(res.status).toBe(200)
    expect(res.body.avatarUrl).toMatch(/^\/api\/profile\/avatar\?v=\d+$/)

    const profile = await request(app).get('/api/profile').set('Cookie', cookie)
    expect(profile.body.avatarUrl).toBe(res.body.avatarUrl)
  })

  it('GET serwuje obraz z poprawnym Content-Type po uploadzie', async () => {
    await request(app)
      .post('/api/profile/avatar')
      .set('Cookie', cookie)
      .attach('avatar', png, { filename: 'a.png', contentType: 'image/png' })
    const res = await request(app).get('/api/profile/avatar').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('image/png')
  })

  // Regresja: gdy ścieżka danych zawiera segment z kropką (np. .claude/worktrees,
  // .data), domyślne dotfiles:'ignore' w res.sendFile zwracało 404 → 500.
  it('GET serwuje obraz, gdy katalog danych leży pod ukrytym segmentem ścieżki', async () => {
    const hiddenDir = path.join(dataDir, '.hidden', 'data')
    process.env.PROFILE_DATA_DIR = hiddenDir
    await request(app)
      .post('/api/profile/avatar')
      .set('Cookie', cookie)
      .attach('avatar', png, { filename: 'a.png', contentType: 'image/png' })
    const res = await request(app).get('/api/profile/avatar').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('image/png')
  })

  it('GET bez zdjęcia zwraca 404 { error }', async () => {
    const res = await request(app).get('/api/profile/avatar').set('Cookie', cookie)
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Brak zdjęcia' })
  })

  it('odrzuca nie-obraz z 400 { error }', async () => {
    const res = await request(app)
      .post('/api/profile/avatar')
      .set('Cookie', cookie)
      .attach('avatar', Buffer.from('tekst'), { filename: 'a.txt', contentType: 'text/plain' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Dozwolone tylko pliki graficzne' })
  })

  it('odrzuca plik powyżej 2 MB z 413 { error }', async () => {
    const big = Buffer.alloc(2 * 1024 * 1024 + 1)
    const res = await request(app)
      .post('/api/profile/avatar')
      .set('Cookie', cookie)
      .attach('avatar', big, { filename: 'big.png', contentType: 'image/png' })
    expect(res.status).toBe(413)
    expect(res.body).toEqual({ error: 'Plik jest za duży (max 2 MB)' })
  })

  it('odrzuca żądanie bez pliku z 400', async () => {
    const res = await request(app).post('/api/profile/avatar').set('Cookie', cookie)
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Brak pliku' })
  })

  it('DELETE /api/profile usuwa też zdjęcie (FR-13)', async () => {
    await request(app)
      .post('/api/profile/avatar')
      .set('Cookie', cookie)
      .attach('avatar', png, { filename: 'a.png', contentType: 'image/png' })
    await request(app).delete('/api/profile').set('Cookie', cookie)
    const res = await request(app).get('/api/profile/avatar').set('Cookie', cookie)
    expect(res.status).toBe(404)
  })
})

describe('autoryzacja', () => {
  const png = Buffer.from('fake-png-bytes')

  it.each([
    ['get', '/api/profile'],
    ['put', '/api/profile'],
    ['delete', '/api/profile'],
    ['get', '/api/profile/avatar'],
    ['post', '/api/profile/avatar'],
  ] as const)('%s %s bez ciasteczka → 401 (FR-15)', async (method, url) => {
    const res = await request(app)[method](url)
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Wymagane logowanie' })
  })

  it('upload avatara bez ciasteczka → 401 i nic nie trafia na dysk (Review Focus 2)', async () => {
    const res = await request(app)
      .post('/api/profile/avatar')
      .attach('avatar', png, { filename: 'a.png', contentType: 'image/png' })
    expect(res.status).toBe(401)
    await expect(fs.access(path.join(dataDir, 'uploads'))).rejects.toThrow()
  })

  it('użytkownik B nie widzi profilu ani avatara A (FR-18)', async () => {
    await request(app).put('/api/profile').set('Cookie', cookie).send(validBody)
    await request(app)
      .post('/api/profile/avatar')
      .set('Cookie', cookie)
      .attach('avatar', png, { filename: 'a.png', contentType: 'image/png' })
    const b = await createUserAndSignIn(app, 'bartek@example.com')

    expect((await request(app).get('/api/profile').set('Cookie', b.cookie)).body).toEqual(
      freshProfile('bartek@example.com'),
    )
    expect((await request(app).get('/api/profile/avatar').set('Cookie', b.cookie)).status).toBe(404)
    const a = await request(app).get('/api/profile').set('Cookie', cookie)
    expect(a.body).toMatchObject(validBody)
    expect(a.body.avatarUrl).toMatch(/^\/api\/profile\/avatar\?v=\d+$/)
  })

  it('PUT z ciasteczkiem i obcym Origin → 403, profil bez zmian (CSRF)', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .send(validBody)
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'Niedozwolony origin' })
    expect((await request(app).get('/api/profile').set('Cookie', cookie)).body).toEqual(ANNA_FRESH)
  })

  it('PUT z własnym Origin → 200', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Cookie', cookie)
      .set('Origin', TEST_ORIGIN)
      .send(validBody)
    expect(res.status).toBe(200)
  })

  it('SEC-B4: mass assignment - _id/userId/avatarUrl z body nie zmieniają cudzego ani własnego profilu', async () => {
    const b = await createUserAndSignIn(app, 'bartek@example.com')
    const res = await request(app)
      .put('/api/profile')
      .set('Cookie', cookie)
      .send({
        ...validBody,
        _id: b.userId,
        userId: b.userId,
        avatarUrl: 'https://evil.example/x.png',
      })
    expect(res.status).toBe(200)
    expect(res.body.avatarUrl).toBe('')
    expect((await request(app).get('/api/profile').set('Cookie', b.cookie)).body).toEqual(
      freshProfile('bartek@example.com'),
    )
  })

  it('SEC-B5: operator Mongo w polu profilu → 400, dokument bez zmian', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Cookie', cookie)
      .send({ ...validBody, firstName: { $gt: '' } })
    expect(res.status).toBe(400)
    expect((await request(app).get('/api/profile').set('Cookie', cookie)).body).toEqual(ANNA_FRESH)
  })
})
