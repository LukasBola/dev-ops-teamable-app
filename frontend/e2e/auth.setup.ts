import { test as setup, expect } from '@playwright/test'
import { PASSWORD, STORAGE_A, USERS, loginAs } from './helpers'

// Projekt `setup` (zależność projektu chromium): loguje A raz i zapisuje sesję dla pozostałych testów.
setup('zaloguj A i zapisz sesję', async ({ request }) => {
  expect(
    PASSWORD,
    'E2E_USER_PASSWORD ustawia orkiestrator (npm --prefix backend run test:e2e)',
  ).not.toBe('')
  await loginAs(request, USERS.a)
  await request.storageState({ path: STORAGE_A })
})
