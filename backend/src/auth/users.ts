import { z } from 'zod'
import { getAuth, PASSWORD_LENGTH } from './auth.js'
import { deleteProfile, writeProfile } from '../services/profileStore.js'

const emailSchema = z.email()
const passwordSchema = z.string().min(PASSWORD_LENGTH.min).max(PASSWORD_LENGTH.max)

export const normalizeEmail = (email: string) => email.trim().toLowerCase()
const ctx = () => getAuth().$context

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const found = await (await ctx()).internalAdapter.findUserByEmail(normalizeEmail(email))
  return found?.user.id ?? null
}

async function requireUserId(email: string): Promise<string> {
  const id = await findUserIdByEmail(email)
  if (!id) throw new Error('Użytkownik nie istnieje')
  return id
}

export async function createCredentialUser(input: {
  email: string
  password: string
  name?: string
}): Promise<{ id: string; email: string }> {
  const email = emailSchema.parse(normalizeEmail(input.email))
  const password = passwordSchema.parse(input.password)
  const { internalAdapter, password: hasher } = await ctx()

  if (await internalAdapter.findUserByEmail(email)) {
    throw new Error('Użytkownik o tym e-mailu już istnieje')
  }
  const hash = await hasher.hash(password)
  const user = await internalAdapter.createUser(
    { email, name: input.name ?? email, emailVerified: false },
    { method: 'admin' },
  )
  try {
    await internalAdapter.linkAccount({
      userId: user.id,
      providerId: 'credential',
      accountId: user.id,
      password: hash,
    })
    // FR-9: nowe konto ma pusty profil z e-mailem kontaktowym = e-mail logowania.
    await writeProfile(user.id, { firstName: '', lastName: '', email, aboutMe: '' })
  } catch (err) {
    // Brak transakcji - sprzątamy ręcznie, żeby nie zostawić usera bez konta lub konta bez usera.
    await internalAdapter.deleteAccounts(user.id)
    await internalAdapter.deleteUser(user.id)
    throw err
  }
  return { id: user.id, email: user.email }
}

export async function setPassword(email: string, password: string): Promise<void> {
  const userId = await requireUserId(email)
  const { internalAdapter, password: hasher } = await ctx()
  await internalAdapter.updatePassword(userId, await hasher.hash(passwordSchema.parse(password)))
  await internalAdapter.deleteUserSessions(userId)
}

export async function deleteUser(email: string): Promise<void> {
  const userId = await requireUserId(email)
  const { internalAdapter } = await ctx()
  await internalAdapter.deleteUserSessions(userId)
  await deleteProfile(userId) // FR-19: profil i avatar
  await internalAdapter.deleteAccounts(userId)
  await internalAdapter.deleteUser(userId)
}
