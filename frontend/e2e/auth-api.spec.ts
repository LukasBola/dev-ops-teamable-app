import { test, expect, type APIRequestContext } from '@playwright/test'
import {
  APP_ORIGIN,
  EMPTY_PROFILE,
  NO_SESSION,
  USERS,
  avatarUpload,
  cookieHeader,
  loginAs,
  newContextAs,
  resetProfile,
  resetProfileA,
  signInRequest,
  uniqueEmail,
} from './helpers'

/**
 * Uwierzytelnianie przez API (przez proxy :4173, jak przeglądarka).
 * Fixture `request` ma sesję A (storageState). Testy, które się wylogowują,
 * robią to na własnej, świeżej sesji — wspólna sesja A musi przetrwać cały przebieg.
 */

const profileA = { firstName: 'Alicja', lastName: 'A', email: 'alicja@example.com', aboutMe: 'A' }

test.beforeEach(async ({ playwright }) => {
  await resetProfileA(playwright)
})

test.describe('pozytywne', () => {
  test('AAPI-P1 logowanie ustawia ciasteczko HttpOnly SameSite=Lax i sesję (FR-14)', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: NO_SESSION, baseURL: APP_ORIGIN })
    const res = await signInRequest(context.request, USERS.a)
    expect(res.status()).toBe(200)
    const setCookie = res
      .headersArray()
      .filter((h) => h.name.toLowerCase() === 'set-cookie')
      .map((h) => h.value)
      .join('\n')
    expect(setCookie).toContain('better-auth.session_token=')
    expect(setCookie).toMatch(/HttpOnly/i)
    expect(setCookie).toMatch(/SameSite=Lax/i)

    const session = await (await context.request.get('/api/auth/get-session')).json()
    expect(session.user.email).toBe(USERS.a)
    await context.close()
  })

  test('AAPI-P2 z sesją: GET/PUT/DELETE profilu i upload/odczyt avatara działają (FR-14, FR-15)', async ({
    request,
  }) => {
    expect((await request.get('/api/profile')).status()).toBe(200)
    expect((await request.put('/api/profile', { data: profileA })).status()).toBe(200)
    expect((await request.post('/api/profile/avatar', { multipart: avatarUpload })).status()).toBe(
      200,
    )
    expect((await request.get('/api/profile/avatar')).status()).toBe(200)
    expect((await request.delete('/api/profile')).status()).toBe(204)
  })

  test('AAPI-P3 wylogowanie kończy sesję (FR-16)', async ({ browser }) => {
    const context = await newContextAs(browser, USERS.a)
    const out = await context.request.post('/api/auth/sign-out', {
      headers: { Origin: APP_ORIGIN },
    })
    expect(out.status()).toBe(200)
    expect(await (await context.request.get('/api/auth/get-session')).json()).toBeNull()
    await context.close()
  })

  test('AAPI-P4 /api/health jest publiczny', async ({ browser }) => {
    const context = await browser.newContext({ storageState: NO_SESSION, baseURL: APP_ORIGIN })
    const res = await context.request.get('/api/health')
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
    await context.close()
  })
})

test.describe('negatywne: brak lub zła sesja', () => {
  test.describe('bez sesji', () => {
    test.use({ storageState: NO_SESSION })

    test('AAPI-N1 każdy endpoint profilu bez sesji → 401, profil A nietknięty (FR-15)', async ({
      request,
      browser,
    }) => {
      const a = await newContextAs(browser, USERS.a)
      await a.request.put('/api/profile', { data: profileA })

      const calls: Array<[string, () => ReturnType<APIRequestContext['get']>]> = [
        ['GET /api/profile', () => request.get('/api/profile')],
        ['PUT /api/profile', () => request.put('/api/profile', { data: EMPTY_PROFILE })],
        ['DELETE /api/profile', () => request.delete('/api/profile')],
        ['GET /api/profile/avatar', () => request.get('/api/profile/avatar')],
        [
          'POST /api/profile/avatar',
          () => request.post('/api/profile/avatar', { multipart: avatarUpload }),
        ],
      ]
      for (const [name, call] of calls) {
        const res = await call()
        expect(res.status(), name).toBe(401)
        expect(await res.json(), name).toEqual({ error: 'Wymagane logowanie' })
      }

      expect(await (await a.request.get('/api/profile')).json()).toMatchObject(profileA)
      expect((await a.request.get('/api/profile/avatar')).status()).toBe(404)
      await a.close()
    })

    test('AAPI-N2 sfałszowane ciasteczko sesji → 401 (FR-15)', async ({ request }) => {
      const res = await request.get('/api/profile', {
        headers: { Cookie: 'better-auth.session_token=sfalszowany' },
      })
      expect(res.status()).toBe(401)
    })

    test('AAPI-N4 publiczna rejestracja jest wyłączona (FR-17)', async ({ request }) => {
      const email = uniqueEmail('rejestracja')
      const up = await request.post('/api/auth/sign-up/email', {
        headers: { Origin: APP_ORIGIN },
        data: { email, password: 'tajne-haslo-123', name: 'X' },
      })
      expect(up.status()).toBeGreaterThanOrEqual(400)
      expect(up.status()).toBeLessThan(500)
      expect((await signInRequest(request, email, 'tajne-haslo-123')).status()).toBe(401)
    })

    test('AAPI-N6 logowanie z obcego originu → 403 i brak ciasteczka', async ({ request }) => {
      const res = await request.post('/api/auth/sign-in/email', {
        headers: { Origin: 'https://evil.example' },
        data: { email: USERS.a, password: process.env.E2E_USER_PASSWORD },
      })
      expect(res.status()).toBe(403)
      expect(res.headers()['set-cookie'] ?? '').not.toContain('session_token')
    })

    test('AAPI-N7 niepełne lub złe body logowania → 4xx (nie 500) i brak ciasteczka (FR-14)', async ({
      request,
    }) => {
      for (const data of [{}, { email: USERS.a }, { email: USERS.a, password: 'a'.repeat(200) }]) {
        const res = await request.post('/api/auth/sign-in/email', {
          headers: { Origin: APP_ORIGIN },
          data,
        })
        expect(res.status(), JSON.stringify(data).slice(0, 60)).toBeGreaterThanOrEqual(400)
        expect(res.status()).toBeLessThan(500)
        expect(res.headers()['set-cookie'] ?? '').not.toContain('session_token')
      }
    })
  })

  test('AAPI-N3 ciasteczko sprzed wylogowania nie działa (replay) (FR-16)', async ({ browser }) => {
    const context = await newContextAs(browser, USERS.a)
    const stolen = await cookieHeader(context)
    await context.request.post('/api/auth/sign-out', { headers: { Origin: APP_ORIGIN } })

    const replay = await browser.newContext({ storageState: NO_SESSION, baseURL: APP_ORIGIN })
    const res = await replay.request.get('/api/profile', { headers: { Cookie: stolen } })
    expect(res.status()).toBe(401)
    await Promise.all([context.close(), replay.close()])
  })

  test('AAPI-N5 z sesją A, ale z obcego originu: zmiany → 403, dane bez zmian (ADR-0003)', async ({
    request,
  }) => {
    await request.put('/api/profile', { data: profileA })
    const evil = { Origin: 'https://evil.example' }

    const put = await request.put('/api/profile', { headers: evil, data: EMPTY_PROFILE })
    const del = await request.delete('/api/profile', { headers: evil })
    const up = await request.post('/api/profile/avatar', { headers: evil, multipart: avatarUpload })
    for (const res of [put, del, up]) {
      expect(res.status()).toBe(403)
      expect(await res.json()).toEqual({ error: 'Niedozwolony origin' })
    }
    expect(await (await request.get('/api/profile')).json()).toMatchObject(profileA)
    expect((await request.get('/api/profile/avatar')).status()).toBe(404)
  })
})

test.describe('negatywne: izolacja użytkowników (FR-18)', () => {
  let b: APIRequestContext

  test.beforeEach(async ({ playwright }) => {
    b = await playwright.request.newContext({ baseURL: APP_ORIGIN })
    await loginAs(b, USERS.b)
    await resetProfile(b)
  })

  test.afterEach(async () => {
    await b.dispose()
  })

  test('AAPI-N8 B nie widzi profilu A (FR-18)', async ({ request }) => {
    await request.put('/api/profile', { data: profileA })
    await request.post('/api/profile/avatar', { multipart: avatarUpload })
    expect(await (await b.get('/api/profile')).json()).toEqual(EMPTY_PROFILE)
  })

  test('AAPI-N9 B pod dokładnym avatarUrl A dostaje 404, nigdy bajtów A (FR-18)', async ({
    request,
  }) => {
    const { avatarUrl } = await (
      await request.post('/api/profile/avatar', { multipart: avatarUpload })
    ).json()
    const res = await b.get(avatarUrl)
    expect(res.status()).toBe(404)
    expect(res.headers()['content-type']).not.toContain('image')
  })

  test('AAPI-N10 DELETE przez B nie rusza profilu ani avatara A (FR-18)', async ({ request }) => {
    await request.put('/api/profile', { data: profileA })
    await request.post('/api/profile/avatar', { multipart: avatarUpload })

    expect((await b.delete('/api/profile')).status()).toBe(204)

    expect(await (await request.get('/api/profile')).json()).toMatchObject(profileA)
    expect((await request.get('/api/profile/avatar')).status()).toBe(200)
  })
})
