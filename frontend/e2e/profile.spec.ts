import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Reset backend state via real endpoint — "first run" state (FR-13).
test.beforeEach(async ({ request }) => {
  const res = await request.delete('/api/profile')
  expect(res.status()).toBe(204)
})

test('pusty profil na czystym stanie (FR-9)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('edit-button').click()
  await expect(page.getByTestId('firstName')).toHaveValue('')
  await expect(page.getByTestId('email')).toHaveValue('')
  await expect(page.getByAltText('Podgląd zdjęcia')).toBeHidden()
})

test('edycja i zapis profilu utrwala dane po reloadzie przez backend (FR-3, FR-4, FR-8)', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('edit-button').click()
  await page.getByTestId('firstName').fill('Grażyna')
  await page.getByTestId('email').fill('grazyna@example.com')
  await page.getByTestId('save-button').click()

  await expect(page.getByTestId('edit-button')).toBeVisible()
  await expect(page.getByText('Grażyna')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Grażyna')).toBeVisible()
})

test('niepoprawny email blokuje zapis (FR-6)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('edit-button').click()
  await page.getByTestId('email').fill('zly-email')
  await page.getByTestId('save-button').click()

  await expect(page.getByTestId('save-button')).toBeVisible()
  await expect(page.getByTestId('email-error')).not.toBeEmpty()
})

test('upload zdjęcia: podgląd, zapis i trwałość po reloadzie (FR-5, FR-10)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('edit-button').click()
  const fileInput = page.locator('input[data-test="avatar"]')
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures/avatar.png'))

  await expect(page.getByAltText('Podgląd zdjęcia')).toBeVisible()

  await page.getByTestId('save-button').click()
  await expect(page.getByTestId('edit-button')).toBeVisible()
  await expect(page.getByAltText('Zdjęcie profilowe')).toBeVisible()

  await page.reload()
  await expect(page.getByAltText('Zdjęcie profilowe')).toBeVisible()
})

test('Anuluj po wybraniu zdjęcia nic nie utrwala (FR-11)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('edit-button').click()
  const fileInput = page.locator('input[data-test="avatar"]')
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures/avatar.png'))
  await expect(page.getByAltText('Podgląd zdjęcia')).toBeVisible()

  await page.getByTestId('cancel-button').click()
  await page.reload()
  await expect(page.getByAltText('Zdjęcie profilowe')).toBeHidden()

  // Backend actually has no photo (not just UI):
  const res = await page.request.get('/api/profile/avatar')
  expect(res.status()).toBe(404)
})
