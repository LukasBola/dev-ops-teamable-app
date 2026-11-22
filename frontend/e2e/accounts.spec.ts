import { test, expect, type Page } from '@playwright/test'
import { existsSync } from 'node:fs'
import path from 'node:path'
import {
  APP_ORIGIN,
  NO_SESSION,
  PASSWORD,
  USERS,
  avatarFile,
  cookieHeader,
  signInRequest,
  uniqueEmail,
  userCli,
} from './helpers'

/**
 * CLI kont (backend/src/cli/user.ts) uruchamiane jako proces, jak robi to właściciel.
 * Testy niszczące konto zawsze na koncie z uniqueEmail — nigdy na A/B.
 */
test.use({ storageState: NO_SESSION })

const NEW_PASSWORD = 'nowe-haslo-e2e-1'

async function create(email: string, password = PASSWORD) {
  const result = await userCli('create', '--email', email, '--password', password)
  expect(result.code, result.output).toBe(0)
}

async function loginInUi(page: Page, email: string, password: string) {
  await page.goto('/')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Hasło', { exact: true }).fill(password)
  await page.getByTestId('login-button').click()
}

test.describe('pozytywne', () => {
  test('ACC-P1 konto z CLI loguje się w UI, e-mail kontaktowy = e-mail konta (FR-17, FR-9)', async ({
    page,
  }) => {
    const email = uniqueEmail('acc-p1')
    await create(email)
    await loginInUi(page, email, PASSWORD)
    await expect(page.getByText('Nowy członek zespołu')).toBeVisible()
    await page.getByTestId('edit-button').click()
    await expect(page.getByTestId('email')).toHaveValue(email)
  })

  test('ACC-P2 set-password: nowe hasło działa (FR-17)', async ({ request }) => {
    const email = uniqueEmail('acc-p2')
    await create(email)
    const result = await userCli('set-password', '--email', email, '--password', NEW_PASSWORD)
    expect(result.code, result.output).toBe(0)
    expect((await signInRequest(request, email, NEW_PASSWORD)).status()).toBe(200)
  })

  test('ACC-P3 delete usuwa tylko wskazane konto; A loguje się i ma swój profil (FR-19)', async ({
    request,
  }) => {
    const email = uniqueEmail('acc-p3')
    await create(email)
    const result = await userCli('delete', '--email', email)
    expect(result.code, result.output).toBe(0)
    expect(result.output).toContain('Usunięto konto')
    expect((await signInRequest(request, email)).status()).toBe(401)
    expect((await signInRequest(request, USERS.a)).status()).toBe(200)
    expect((await request.get('/api/profile')).status()).toBe(200)
  })
})

test.describe('negatywne', () => {
  test('ACC-N1 set-password w tle wylogowuje otwartą kartę, stare hasło nie działa (FR-17)', async ({
    page,
  }) => {
    const email = uniqueEmail('acc-n1')
    await create(email)
    await loginInUi(page, email, PASSWORD)
    await expect(page.getByTestId('edit-button')).toBeVisible()

    expect((await userCli('set-password', '--email', email, '--password', NEW_PASSWORD)).code).toBe(
      0,
    )

    await page.reload()
    await expect(page.getByTestId('login-button')).toBeVisible()
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Hasło', { exact: true }).fill(PASSWORD)
    await page.getByTestId('login-button').click()
    await expect(page.getByTestId('login-error')).toHaveText('Niepoprawny e-mail lub hasło')
  })

  test('ACC-N2 delete usuwa konto, sesję, profil i avatar (FR-19)', async ({ page }) => {
    const email = uniqueEmail('acc-n2')
    await create(email)
    await loginInUi(page, email, PASSWORD)
    await page.getByTestId('edit-button').click()
    await page.getByTestId('firstName').fill('Celina')
    await page.locator('input[data-test="avatar"]').setInputFiles(avatarFile)
    await page.getByTestId('save-button').click()
    await expect(page.getByAltText('Zdjęcie profilowe')).toBeVisible()

    const userId = (await (await page.request.get('/api/auth/get-session')).json()).user.id
    const avatarDir = path.join(process.env.PROFILE_DATA_DIR ?? '', 'uploads', userId)
    expect(existsSync(avatarDir)).toBe(true)
    const oldCookie = await cookieHeader(page.context())

    const result = await userCli('delete', '--email', email)
    expect(result.code, result.output).toBe(0)

    await page.reload()
    await expect(page.getByTestId('login-button')).toBeVisible()
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Hasło', { exact: true }).fill(PASSWORD)
    await page.getByTestId('login-button').click()
    await expect(page.getByTestId('login-error')).toBeVisible()

    const replay = await page.request.get(`${APP_ORIGIN}/api/profile`, {
      headers: { Cookie: oldCookie },
    })
    expect(replay.status()).toBe(401)
    expect(existsSync(avatarDir)).toBe(false)
  })

  test('ACC-N3 create z e-mailem A → błąd, A loguje się dalej swoim hasłem (FR-17)', async ({
    request,
  }) => {
    const result = await userCli('create', '--email', USERS.a, '--password', 'inne-haslo-123')
    expect(result.code).not.toBe(0)
    expect(result.output).toContain('już istnieje')
    expect((await signInRequest(request, USERS.a, PASSWORD)).status()).toBe(200)
    expect((await signInRequest(request, USERS.a, 'inne-haslo-123')).status()).toBe(401)
  })

  test('ACC-N4 create z hasłem 7 znaków → błąd i brak konta (FR-17)', async ({ request }) => {
    const email = uniqueEmail('acc-n4')
    const result = await userCli('create', '--email', email, '--password', 'krotkie')
    expect(result.code).not.toBe(0)
    expect((await signInRequest(request, email, 'krotkie')).status()).toBe(401)
  })
})
