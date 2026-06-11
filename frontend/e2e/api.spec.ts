import { test, expect } from '@playwright/test'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Czysto API-owy zestaw testów — odpowiednik kolekcji w Postmanie.
 *
 * Używa fixture `request` (APIRequestContext): wysyła żądania HTTP bez przeglądarki.
 * Ścieżki są względne (`/api/...`), więc lecą na baseURL z playwright.config.ts
 * (preview na :4173), a stamtąd proxy przekazuje je do backendu na :3001 —
 * dokładnie tak, jak robi to prawdziwa aplikacja.
 *
 * webServer w konfiguracji startuje backend + frontend automatycznie, więc
 * wystarczy: `npm run test:e2e`. Żeby odpalić tylko ten plik:
 *   npx playwright test e2e/api.spec.ts
 */

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
  aboutMe: 'Testuję API.',
}

// Każdy test startuje z czystego stanu (jak "reset" kolekcji w Postmanie).
test.beforeEach(async ({ request }) => {
  const res = await request.delete('/api/profile')
  expect(res.status()).toBe(204)
})

test.describe('Health', () => {
  test('GET /api/health → 200 { status: "ok" }', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

test.describe('Profil — odczyt i zapis', () => {
  test('GET /api/profile na czystym stanie → pusty profil (FR-9)', async ({ request }) => {
    const res = await request.get('/api/profile')
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual(EMPTY_PROFILE)
  })

  test('PUT /api/profile tworzy/aktualizuje profil i odsyła zapisane dane', async ({ request }) => {
    const res = await request.put('/api/profile', { data: validProfile })
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ ...validProfile, avatarUrl: '' })
  })

  test('PUT zapisuje trwale — kolejny GET zwraca te same dane', async ({ request }) => {
    await request.put('/api/profile', { data: validProfile })

    const res = await request.get('/api/profile')
    expect(await res.json()).toEqual({ ...validProfile, avatarUrl: '' })
  })

  test('PUT nadpisuje istniejący profil (update)', async ({ request }) => {
    await request.put('/api/profile', { data: validProfile })

    const updated = { ...validProfile, firstName: 'Bożena', aboutMe: 'Zmienione.' }
    const res = await request.put('/api/profile', { data: updated })
    expect(res.status()).toBe(200)
    expect(await res.json()).toMatchObject({ firstName: 'Bożena', aboutMe: 'Zmienione.' })
  })

  test('PUT akceptuje pusty email (pole opcjonalne, FR-9)', async ({ request }) => {
    const res = await request.put('/api/profile', { data: { ...validProfile, email: '' } })
    expect(res.status()).toBe(200)
    expect((await res.json()).email).toBe('')
  })

  test('PUT ignoruje avatarUrl i nieznane pola z body (whitelist)', async ({ request }) => {
    const res = await request.put('/api/profile', {
      data: { ...validProfile, avatarUrl: '/oszukany.png', rola: 'admin' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.avatarUrl).toBe('') // nie da się ustawić avatara przez PUT
    expect(body).not.toHaveProperty('rola') // nieznane pola odcięte
  })
})

test.describe('Profil — walidacja (błędne dane → 400 { error })', () => {
  test('PUT z niepoprawnym emailem → 400 "Niepoprawny adres email"', async ({ request }) => {
    const res = await request.put('/api/profile', {
      data: { ...validProfile, email: 'to-nie-email' },
    })
    expect(res.status()).toBe(400)
    expect(await res.json()).toEqual({ error: 'Niepoprawny adres email' })
  })

  test('PUT z brakującym polem → 400 "Niepoprawne dane profilu"', async ({ request }) => {
    const res = await request.put('/api/profile', {
      data: { firstName: 'Tylko imię' }, // brak lastName/email/aboutMe
    })
    expect(res.status()).toBe(400)
    expect(await res.json()).toEqual({ error: 'Niepoprawne dane profilu' })
  })

  test('PUT z błędnym typem pola → 400', async ({ request }) => {
    const res = await request.put('/api/profile', {
      data: { ...validProfile, firstName: 123 },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBeTruthy()
  })
})

test.describe('Avatar — upload i serwowanie', () => {
  test('POST /api/profile/avatar → 200 { avatarUrl } z cache-bustingiem (FR-10)', async ({
    request,
  }) => {
    const res = await request.post('/api/profile/avatar', {
      multipart: {
        avatar: { name: 'avatar.png', mimeType: 'image/png', buffer: avatarPng },
      },
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).avatarUrl).toMatch(/^\/api\/profile\/avatar\?v=\d+$/)
  })

  test('po uploadzie GET /api/profile zawiera avatarUrl', async ({ request }) => {
    const upload = await request.post('/api/profile/avatar', {
      multipart: { avatar: { name: 'avatar.png', mimeType: 'image/png', buffer: avatarPng } },
    })
    const { avatarUrl } = await upload.json()

    const res = await request.get('/api/profile')
    expect((await res.json()).avatarUrl).toBe(avatarUrl)
  })

  test('GET /api/profile/avatar serwuje obraz z Content-Type image/png', async ({ request }) => {
    await request.post('/api/profile/avatar', {
      multipart: { avatar: { name: 'avatar.png', mimeType: 'image/png', buffer: avatarPng } },
    })
    const res = await request.get('/api/profile/avatar')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('image/png')
  })

  test('GET /api/profile/avatar bez zdjęcia → 404 { error }', async ({ request }) => {
    const res = await request.get('/api/profile/avatar')
    expect(res.status()).toBe(404)
    expect(await res.json()).toEqual({ error: 'Brak zdjęcia' })
  })

  test('POST avatar z plikiem nie-obrazem → 400 { error }', async ({ request }) => {
    const res = await request.post('/api/profile/avatar', {
      multipart: {
        avatar: { name: 'plik.txt', mimeType: 'text/plain', buffer: Buffer.from('to nie obraz') },
      },
    })
    expect(res.status()).toBe(400)
    expect(await res.json()).toEqual({ error: 'Dozwolone tylko pliki graficzne' })
  })

  test('POST avatar powyżej 2 MB → 413 { error }', async ({ request }) => {
    const tooBig = Buffer.alloc(2 * 1024 * 1024 + 1)
    const res = await request.post('/api/profile/avatar', {
      multipart: { avatar: { name: 'duzy.png', mimeType: 'image/png', buffer: tooBig } },
    })
    expect(res.status()).toBe(413)
    expect(await res.json()).toEqual({ error: 'Plik jest za duży (max 2 MB)' })
  })

  test('POST avatar bez pliku → 400 { error }', async ({ request }) => {
    const res = await request.post('/api/profile/avatar', { multipart: {} })
    expect(res.status()).toBe(400)
    expect(await res.json()).toEqual({ error: 'Brak pliku' })
  })
})

test.describe('Profil — usuwanie (DELETE)', () => {
  test('DELETE /api/profile → 204 i czyści profil oraz zdjęcie (FR-13)', async ({ request }) => {
    // Przygotuj stan: profil + avatar.
    await request.put('/api/profile', { data: validProfile })
    await request.post('/api/profile/avatar', {
      multipart: { avatar: { name: 'avatar.png', mimeType: 'image/png', buffer: avatarPng } },
    })

    const del = await request.delete('/api/profile')
    expect(del.status()).toBe(204)

    // Profil wrócił do pustego, zdjęcia nie ma.
    expect(await (await request.get('/api/profile')).json()).toEqual(EMPTY_PROFILE)
    const avatarRes = await request.get('/api/profile/avatar')
    expect(avatarRes.status()).toBe(404)
  })

  test('DELETE na czystym stanie jest idempotentne → 204', async ({ request }) => {
    const res = await request.delete('/api/profile')
    expect(res.status()).toBe(204)
  })
})
