import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('edycja i zapis profilu utrwala dane po reloadzie (FR-3, FR-4, FR-7)', async ({ page }) => {
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

test('wczytanie zdjęcia pokazuje podgląd (FR-5)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('edit-button').click()
  const fileInput = page.locator('input[data-test="avatar"]')
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures/avatar.png'))

  await expect(page.getByAltText('Podgląd zdjęcia')).toBeVisible()
})
