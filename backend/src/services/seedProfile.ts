import {
  createCredentialUser,
  findUserIdByEmail,
  normalizeEmail,
  setPassword,
} from '../auth/users.js'
import { writeProfile } from './profileStore.js'

export const DEMO_PROFILE = {
  firstName: 'Jan',
  lastName: 'Kowalski',
  email: 'jan@example.com',
  aboutMe: 'Przykładowy profil demo (seed).',
}

/**
 * Idempotentne konto demo: brak → tworzy, istnieje → ustawia hasło z env. Nie dotyka singletonu.
 * Czyta `process.env` na żywo (nie memoizowane `env()`), bo wartości mogą się zmienić między wywołaniami.
 */
export async function seedDemoUser(): Promise<void> {
  const { DEMO_USER_EMAIL: email, DEMO_USER_PASSWORD: password } = process.env
  if (!email) throw new Error('Brak DEMO_USER_EMAIL')
  if (!password) throw new Error('Brak DEMO_USER_PASSWORD')

  const existingId = await findUserIdByEmail(email)
  if (existingId) await setPassword(email, password)
  const id = existingId ?? (await createCredentialUser({ email, password })).id
  await writeProfile(id, { ...DEMO_PROFILE, email: normalizeEmail(email) })
}
