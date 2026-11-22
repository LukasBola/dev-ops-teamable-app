import { test, expect } from '@playwright/test'
import {
  APP_ORIGIN,
  EMPTY_PROFILE,
  PASSWORD,
  USERS,
  loginAs,
  newContextAs,
  resetProfile,
} from './helpers'

/** Ataki z perspektywy przeglądarki i klienta. Backendowe odpowiedniki: SEC-B1…B5 (Vitest). */

const EVIL = 'https://evil.example'
const profileA = { firstName: 'Alicja', lastName: 'A', email: 'alicja@example.com', aboutMe: 'A' }

test.beforeEach(async ({ request }) => {
  await resetProfile(request)
})

test('SEC-1 skrypt na stronie nie widzi ciasteczka sesji (HttpOnly, ADR-0001)', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('edit-button')).toBeVisible()
  expect(await page.evaluate(() => document.cookie)).not.toContain('session_token')
})

test('SEC-2 formularz z obcej strony (CSRF) nie zmienia profilu A (ADR-0003)', async ({
  page,
  request,
}) => {
  await request.put('/api/profile', { data: profileA })
  await page.route(`${EVIL}/**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<form id="f" method="POST" action="${APP_ORIGIN}/api/profile/avatar" enctype="multipart/form-data">
               <input name="avatar" value="x"></form>
             <script>document.getElementById('f').submit()</script>`,
    }),
  )
  const attack = page
    .waitForResponse((r) => r.url().startsWith(`${APP_ORIGIN}/api/profile/avatar`), {
      timeout: 5000,
    })
    .catch(() => null) // przeglądarka może zablokować żądanie zanim wyjdzie — też dobrze
  await page.goto(`${EVIL}/`)
  const res = await attack
  // Albo żądanie nie wyszło (null), albo backend je odrzucił: bez ciasteczka 401, z obcym Origin 403.
  expect(res === null || [401, 403].includes(res.status())).toBe(true)

  expect(await (await request.get('/api/profile')).json()).toMatchObject(profileA)
  expect((await request.get('/api/profile/avatar')).status()).toBe(404)
})

test('SEC-3 obca strona nie odczyta profilu A przez fetch z ciasteczkami (ADR-0002)', async ({
  page,
  request,
}) => {
  await request.put('/api/profile', { data: profileA })
  await page.route(`${EVIL}/**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>evil</p>' }),
  )
  await page.goto(`${EVIL}/`)
  const leaked = await page.evaluate(async (url) => {
    try {
      const res = await fetch(url, { credentials: 'include' })
      return await res.text()
    } catch {
      return 'zablokowane'
    }
  }, `${APP_ORIGIN}/api/profile`)
  expect(leaked).toBe('zablokowane')
})

test('SEC-4 NoSQL injection w logowaniu → 4xx i brak ciasteczka (FR-14)', async ({
  playwright,
}) => {
  const anon = await playwright.request.newContext({ baseURL: APP_ORIGIN })
  for (const data of [
    { email: { $ne: null }, password: { $ne: null } },
    { email: USERS.a, password: { $ne: null } },
  ]) {
    const res = await anon.post('/api/auth/sign-in/email', {
      headers: { Origin: APP_ORIGIN },
      data,
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
    expect(res.headers()['set-cookie'] ?? '').not.toContain('session_token')
  }
  await anon.dispose()
})

test('SEC-5 pola _id/userId w body nie pozwalają zapisać cudzego profilu (FR-18)', async ({
  request,
  playwright,
}) => {
  const b = await playwright.request.newContext({ baseURL: APP_ORIGIN })
  await loginAs(b, USERS.b)
  await resetProfile(b)
  const bId = (await (await b.get('/api/auth/get-session')).json()).user.id

  const res = await request.put('/api/profile', {
    data: { ...profileA, _id: bId, userId: bId },
  })
  expect(res.status()).toBe(200)
  expect(await (await b.get('/api/profile')).json()).toEqual(EMPTY_PROFILE)
  await b.dispose()
})

test('SEC-6 path traversal przez ścieżki avatara nie zwraca plików spoza katalogu A (FR-18)', async ({
  request,
}) => {
  for (const url of [
    '/api/profile/avatar/..%2f..%2f..%2fetc%2fpasswd',
    '/api/profile/avatar?v=../../../package.json',
    '/api/profile/..%2f..%2fpackage.json',
    '/api/profile/avatar/%2e%2e/%2e%2e/package.json',
  ]) {
    const res = await request.get(url)
    expect([400, 404], url).toContain(res.status())
    const body = await res.text()
    expect(body, url).not.toContain('root:')
    expect(body, url).not.toContain('"dependencies"')
  }
})

test('SEC-7 po wylogowaniu przycisk „Wstecz” nie oddaje danych A (FR-16)', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()
  await page.goto('/')
  await page.getByLabel('E-mail').fill(USERS.a)
  await page.getByLabel('Hasło', { exact: true }).fill(PASSWORD)
  await page.getByTestId('login-button').click()
  await expect(page.getByTestId('edit-button')).toBeVisible()

  await page.goto('/?druga-strona')
  await expect(page.getByTestId('edit-button')).toBeVisible()
  const leaks: number[] = []
  page.on('response', (r) => {
    if (new URL(r.url()).pathname === '/api/profile' && r.status() === 200) leaks.push(r.status())
  })
  await page.getByTestId('logout-button').click()
  await expect(page.getByTestId('login-button')).toBeVisible()

  await page.goBack()
  await page.reload()
  await expect(page.getByTestId('login-button')).toBeVisible()
  expect((await context.request.get('/api/profile')).status()).toBe(401)
  expect(leaks).toEqual([])
  await context.close()
})

test('SEC-8 odpowiedzi logowania i sesji nie zawierają hasła ani hasha (FR-14)', async ({
  browser,
}) => {
  const context = await newContextAs(browser, USERS.a)
  const signIn = await context.request.post('/api/auth/sign-in/email', {
    headers: { Origin: APP_ORIGIN },
    data: { email: USERS.a, password: PASSWORD },
  })
  const session = await context.request.get('/api/auth/get-session')
  for (const res of [signIn, session]) {
    const text = await res.text()
    expect(text).not.toMatch(/password/i)
    expect(text).not.toContain(PASSWORD)
    const user = JSON.parse(text).user
    expect(Object.keys(user).sort()).toEqual(
      expect.arrayContaining(['email', 'emailVerified', 'id', 'name']),
    )
    for (const key of Object.keys(user)) {
      expect(['id', 'email', 'name', 'emailVerified', 'image', 'createdAt', 'updatedAt']).toContain(
        key,
      )
    }
  }
  await context.close()
})
