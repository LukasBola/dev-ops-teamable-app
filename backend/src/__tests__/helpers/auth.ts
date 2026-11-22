import request from 'supertest'
import type { Express } from 'express'
import { createCredentialUser } from '../../auth/users.js'

export const TEST_ORIGIN = 'http://localhost:4173'
export const TEST_PASSWORD = 'tajne-haslo-123'

/** Loguje i zwraca wartość nagłówka `Cookie` do kolejnych żądań. */
export async function signIn(app: Express, email: string, password: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/sign-in/email')
    .set('Origin', TEST_ORIGIN)
    .send({ email, password })
  if (res.status !== 200) throw new Error(`Logowanie nieudane (${res.status}): ${res.text}`)
  const setCookie = res.headers['set-cookie'] as unknown as string[]
  return setCookie.map((c) => c.split(';')[0]).join('; ')
}

export async function createUserAndSignIn(
  app: Express,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<{ userId: string; cookie: string }> {
  const { id } = await createCredentialUser({ email, password })
  return { userId: id, cookie: await signIn(app, email, password) }
}
