import { test, expect, type Page } from '@playwright/test'
import { NO_SESSION, PASSWORD, USERS, loginAs, resetProfile } from './helpers'

/** Logowanie przez interfejs. Każdy test zaczyna bez sesji, więc wylogowanie nie rusza wspólnej sesji A. */
test.use({ storageState: NO_SESSION })

async function fillLogin(page: Page, email: string, password: string) {
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Hasło', { exact: true }).fill(password)
}

async function sessionCookie(page: Page) {
  return (await page.context().cookies()).find((c) => c.name.includes('session_token'))
}

test.beforeEach(async ({ request }) => {
  await loginAs(request, USERS.a)
  await resetProfile(request)
})

test.describe('pozytywne', () => {
  test('AUI-P1 poprawne dane → widok profilu (FR-14)', async ({ page }) => {
    await page.goto('/')
    await fillLogin(page, USERS.a, PASSWORD)
    await page.getByTestId('login-button').click()

    await expect(page.getByTestId('edit-button')).toBeVisible()
    await expect(page.getByTestId('login-button')).toHaveCount(0)
    await expect(page.getByText(USERS.a)).toBeVisible() // e-mail w nagłówku
  })

  test('AUI-P2 po przeładowaniu strony sesja zostaje (FR-14)', async ({ page }) => {
    await page.goto('/')
    await fillLogin(page, USERS.a, PASSWORD)
    await page.getByTestId('login-button').click()
    await expect(page.getByTestId('edit-button')).toBeVisible()

    await page.reload()
    await expect(page.getByTestId('edit-button')).toBeVisible()
    await expect(page.getByTestId('login-button')).toHaveCount(0)
  })

  test('AUI-P3 logowanie samą klawiaturą: Tab i Enter (FR-14, dostępność)', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('E-mail').focus()
    await page.keyboard.type(USERS.a)
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Hasło', { exact: true })).toBeFocused()
    await page.keyboard.type(PASSWORD)
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('edit-button')).toBeVisible()
  })

  test('AUI-P4 e-mail wpisany innymi literami loguje (FR-14)', async ({ page }) => {
    await page.goto('/')
    await fillLogin(page, 'E2E-A@Example.com', PASSWORD)
    await page.getByTestId('login-button').click()
    await expect(page.getByTestId('edit-button')).toBeVisible()
  })

  test('AUI-P5 wylogowanie wraca do logowania także po przeładowaniu (FR-16)', async ({ page }) => {
    await page.goto('/')
    await fillLogin(page, USERS.a, PASSWORD)
    await page.getByTestId('login-button').click()
    await expect(page.getByTestId('edit-button')).toBeVisible()

    await page.getByTestId('logout-button').click()
    await expect(page.getByTestId('login-button')).toBeVisible()
    await expect(page.getByTestId('status')).toHaveText('Wylogowano.')

    await page.reload()
    await expect(page.getByTestId('login-button')).toBeVisible()
    expect(await sessionCookie(page)).toBeUndefined()
  })

  test('AUI-P6 zmiana konta w tej samej karcie: dane A nie pokazują się u B (FR-18)', async ({
    page,
    playwright,
  }) => {
    const b = await playwright.request.newContext({ baseURL: 'http://localhost:4173' })
    await loginAs(b, USERS.b)
    await resetProfile(b)
    await b.dispose()

    await page.goto('/')
    await fillLogin(page, USERS.a, PASSWORD)
    await page.getByTestId('login-button').click()
    await page.getByTestId('edit-button').click()
    await page.getByTestId('firstName').fill('Alicja')
    await page.getByTestId('save-button').click()
    await expect(page.getByText('Alicja')).toBeVisible()

    await page.getByTestId('logout-button').click()
    await fillLogin(page, USERS.b, PASSWORD)

    // Obserwator w stronie: od kliknięcia „Zaloguj” do widoku B słowo „Alicja” nie może się pojawić.
    await page.evaluate(() => {
      const w = window as unknown as { __sawA: boolean }
      w.__sawA = false
      new MutationObserver(() => {
        if (document.body.innerText.includes('Alicja')) w.__sawA = true
      }).observe(document.body, { subtree: true, childList: true, characterData: true })
    })
    await page.getByTestId('login-button').click()
    await expect(page.getByText(USERS.b)).toBeVisible()
    await expect(page.getByTestId('edit-button')).toBeVisible()

    expect(await page.evaluate(() => (window as unknown as { __sawA: boolean }).__sawA)).toBe(false)
    await expect(page.getByText('Alicja')).toHaveCount(0)
  })
})

test.describe('negatywne', () => {
  test('AUI-N1 złe hasło: komunikat, brak profilu i brak ciasteczka sesji (FR-14)', async ({
    page,
  }) => {
    await page.goto('/')
    await fillLogin(page, USERS.a, 'zle-haslo-123')
    await page.getByTestId('login-button').click()

    await expect(page.getByTestId('login-error')).toHaveText('Niepoprawny e-mail lub hasło')
    await expect(page.getByTestId('edit-button')).toHaveCount(0)
    expect(await sessionCookie(page)).toBeUndefined()
    await expect(page.getByLabel('E-mail')).toHaveValue(USERS.a)
    await expect(page.getByLabel('Hasło', { exact: true })).toHaveValue('')
  })

  test('AUI-N2 nieistniejący e-mail: ten sam komunikat co złe hasło (brak enumeracji kont, FR-14)', async ({
    page,
  }) => {
    await page.goto('/')
    await fillLogin(page, 'nikogo-takiego@example.com', 'zle-haslo-123')
    await page.getByTestId('login-button').click()
    await expect(page.getByTestId('login-error')).toHaveText('Niepoprawny e-mail lub hasło')
  })

  test('AUI-N3 puste pola: przeglądarka nie wysyła formularza, brak żądania logowania (FR-14)', async ({
    page,
  }) => {
    const signIns: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/auth/sign-in')) signIns.push(r.url())
    })
    await page.goto('/')
    await page.getByTestId('login-button').click()
    // Walidacja przeglądarki zatrzymuje wysyłkę i przenosi fokus na pierwsze puste pole.
    await expect(page.getByLabel('E-mail')).toBeFocused()
    expect(
      await page.getByLabel('E-mail').evaluate((el: HTMLInputElement) => el.validity.valueMissing),
    ).toBe(true)
    expect(signIns).toEqual([])
    await expect(page.getByTestId('login-button')).toBeVisible()
  })

  test('AUI-N4 wejście bez sesji: ekran logowania i zero zapytań o profil (FR-15)', async ({
    page,
  }) => {
    const profileCalls: string[] = []
    page.on('request', (r) => {
      if (new URL(r.url()).pathname.startsWith('/api/profile')) profileCalls.push(r.url())
    })
    const sessionChecked = page.waitForResponse((r) => r.url().includes('/api/auth/get-session'))
    await page.goto('/')
    await sessionChecked
    await expect(page.getByTestId('login-button')).toBeVisible()
    expect(profileCalls).toEqual([])
    await expect(page.getByTestId('edit-button')).toHaveCount(0)
  })

  test('AUI-N5 sesja znika w trakcie edycji: zapis wraca do logowania bez błędu JS (FR-15, FR-16)', async ({
    page,
  }) => {
    const pageErrors: Error[] = []
    page.on('pageerror', (e) => pageErrors.push(e))
    await page.goto('/')
    await fillLogin(page, USERS.a, PASSWORD)
    await page.getByTestId('login-button').click()
    await page.getByTestId('edit-button').click()

    await page.context().clearCookies()
    const save = page.waitForResponse(
      (r) => r.url().endsWith('/api/profile') && r.request().method() === 'PUT',
    )
    await page.getByTestId('save-button').click()
    expect((await save).status()).toBe(401)

    await expect(page.getByTestId('login-button')).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test('AUI-N6 po błędnym logowaniu poprawne dane działają, błąd znika (FR-14)', async ({
    page,
  }) => {
    await page.goto('/')
    await fillLogin(page, USERS.a, 'zle-haslo-123')
    await page.getByTestId('login-button').click()
    await expect(page.getByTestId('login-error')).toBeVisible()

    await page.getByLabel('Hasło', { exact: true }).fill(PASSWORD)
    await page.getByTestId('login-button').click()
    await expect(page.getByTestId('edit-button')).toBeVisible()
    await expect(page.getByTestId('login-error')).toHaveCount(0)
  })
})
