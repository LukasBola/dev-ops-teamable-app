import { test, expect } from '@playwright/test'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Zestaw DIAGNOSTYCZNY — uderza wprost w backend na :3001, z pominięciem proxy.
 *
 * `test.use({ baseURL })` nadpisuje bazowy URL z playwright.config.ts (:4173)
 * dla całego tego pliku, więc względne ścieżki `/api/...` lecą bezpośrednio na
 * backend, a nie przez serwer preview frontendu.
 *
 * Po co osobny plik: gdy api.spec.ts (przez :4173 → proxy) zacznie padać, ten
 * zestaw odpowiada na pytanie „to wina backendu czy proxy?". Jeśli tu zielono,
 * a tam czerwono → problem leży w proxy/konfiguracji frontendu, nie w API.
 *
 * Uruchomienie (Playwright sam wystartuje backend przez webServer):
 *   npx playwright test e2e/api-direct.spec.ts
 */

test.use({ baseURL: 'http://localhost:3001' })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const avatarPng = readFileSync(path.join(__dirname, 'fixtures/avatar.png'))

const EMPTY_PROFILE = {
  firstName: '',
  lastName: '',
  email: '',
  aboutMe: '',
  avatarUrl: '',
}

const validProfile = {
  firstName: 'Grażyna',
  lastName: 'Kowalska',
  email: 'grazyna@example.com',
  aboutMe: 'Testuję API bezpośrednio.',
}

test.beforeEach(async ({ request }) => {
  const res = await request.delete('/api/profile')
  expect(res.status()).toBe(204)
})

test('health odpowiada bezpośrednio na :3001', async ({ request }) => {
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
