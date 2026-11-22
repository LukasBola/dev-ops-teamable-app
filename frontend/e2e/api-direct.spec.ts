import { test, expect } from '@playwright/test'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { APP_ORIGIN, EMPTY_PROFILE, NO_SESSION, PASSWORD, USERS, resetProfileA } from './helpers'

/**
 * Zestaw DIAGNOSTYCZNY — uderza wprost w izolowany backend E2E (:3101),
 * z pominięciem proxy.
 *
 * `test.use({ baseURL })` nadpisuje bazowy URL z playwright.config.ts (:4173)
 * dla całego tego pliku, więc względne ścieżki `/api/...` lecą bezpośrednio na
 * backend E2E, a nie przez serwer preview frontendu. Celowo NIE :3001 — tam
 * działa lokalny dev-backend z prawdziwymi danymi.
 *
 * Po co osobny plik: gdy api.spec.ts (przez :4173 → proxy) zacznie padać, ten
 * zestaw odpowiada na pytanie „to wina backendu czy proxy?". Jeśli tu zielono,
 * a tam czerwono → problem leży w proxy/konfiguracji frontendu, nie w API.
 *
 * Sesja A ze storageState działa i tutaj: ciasteczka nie zależą od portu (ten sam host localhost).
 */

// Hits the ISOLATED E2E backend directly (port 3101 from `start:e2e`), bypassing
// the preview proxy. Must NOT target :3001 — that's the local dev backend with
// real data, which the per-test DELETE resets would wipe.
test.use({ baseURL: 'http://localhost:3101' })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const avatarPng = readFileSync(path.join(__dirname, 'fixtures/avatar.png'))

const validProfile = {
  firstName: 'Grażyna',
  lastName: 'Kowalska',
  email: 'grazyna@example.com',
  aboutMe: 'Testuję API bezpośrednio.',
}

test.beforeEach(async ({ playwright }) => {
  await resetProfileA(playwright, 'http://localhost:3101')
})

test('health odpowiada bezpośrednio na :3101', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.status()).toBe(200)
  expect(await res.json()).toEqual({ status: 'ok' })
})

test('pełny cykl życia profilu wprost na backendzie (create → read → update → delete)', async ({
  request,
}) => {
  // CREATE
  const created = await request.put('/api/profile', { data: validProfile })
  expect(created.status()).toBe(200)
  expect(await created.json()).toEqual({ ...validProfile, avatarUrl: '' })

  // READ
  const read = await request.get('/api/profile')
  expect(await read.json()).toEqual({ ...validProfile, avatarUrl: '' })

  // UPDATE
  const updated = await request.put('/api/profile', {
    data: { ...validProfile, firstName: 'Bożena' },
  })
  expect((await updated.json()).firstName).toBe('Bożena')

  // DELETE → wraca do pustego
  const deleted = await request.delete('/api/profile')
  expect(deleted.status()).toBe(204)
  expect(await (await request.get('/api/profile')).json()).toEqual(EMPTY_PROFILE)
})

test('walidacja działa na backendzie: zły email → 400 { error }', async ({ request }) => {
  const res = await request.put('/api/profile', {
    data: { ...validProfile, email: 'nie-email' },
  })
  expect(res.status()).toBe(400)
  expect(await res.json()).toEqual({ error: 'Niepoprawny adres email' })
})

test('cykl życia avatara wprost na backendzie (upload → serwowanie → 404 po delete)', async ({
  request,
}) => {
  // UPLOAD
  const upload = await request.post('/api/profile/avatar', {
    multipart: { avatar: { name: 'avatar.png', mimeType: 'image/png', buffer: avatarPng } },
  })
  expect(upload.status()).toBe(200)
  expect((await upload.json()).avatarUrl).toMatch(/^\/api\/profile\/avatar\?v=\d+$/)

  // SERWOWANIE pliku
  const served = await request.get('/api/profile/avatar')
  expect(served.status()).toBe(200)
  expect(served.headers()['content-type']).toContain('image/png')

  // DELETE czyści też zdjęcie
  await request.delete('/api/profile')
  const afterDelete = await request.get('/api/profile/avatar')
  expect(afterDelete.status()).toBe(404)
})

test('odrzucenie nie-obrazu wprost na backendzie → 400 { error }', async ({ request }) => {
  const res = await request.post('/api/profile/avatar', {
    multipart: {
      avatar: { name: 'plik.txt', mimeType: 'text/plain', buffer: Buffer.from('nie obraz') },
    },
  })
  expect(res.status()).toBe(400)
  expect(await res.json()).toEqual({ error: 'Dozwolone tylko pliki graficzne' })
})

test.describe('diagnostyka uwierzytelniania wprost na backendzie', () => {
  test.use({ storageState: NO_SESSION })

  test('DIRECT-N1 bez sesji → 401 także z pominięciem proxy (FR-15)', async ({ request }) => {
    const res = await request.get('/api/profile')
    expect(res.status()).toBe(401)
    expect(await res.json()).toEqual({ error: 'Wymagane logowanie' })
  })

  test('DIRECT-N2 logowanie z obcego originu → 403 także z pominięciem proxy', async ({
    request,
  }) => {
    const res = await request.post('/api/auth/sign-in/email', {
      headers: { Origin: 'https://evil.example' },
      data: { email: USERS.a, password: PASSWORD },
    })
    expect(res.status()).toBe(403)
  })

  test('DIRECT-P1 logowanie z własnym originem działa wprost na backendzie (FR-14)', async ({
    request,
  }) => {
    const res = await request.post('/api/auth/sign-in/email', {
      headers: { Origin: APP_ORIGIN },
      data: { email: USERS.a, password: PASSWORD },
    })
    expect(res.status()).toBe(200)
  })
})
