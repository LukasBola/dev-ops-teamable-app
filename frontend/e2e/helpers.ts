import { spawn } from 'node:child_process'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type PlaywrightWorkerArgs,
} from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Konta zakładane przez orkiestrator (backend/scripts/e2e-mongo.ts). */
export const USERS = { a: 'e2e-a@example.com', b: 'e2e-b@example.com' } as const
export const PASSWORD = process.env.E2E_USER_PASSWORD ?? ''
export const APP_ORIGIN = 'http://localhost:4173'
export const STORAGE_A = path.join(__dirname, '.auth/user-a.json')
export const avatarPng = readFileSync(path.join(__dirname, 'fixtures/avatar.png'))
export const avatarFile = path.join(__dirname, 'fixtures/avatar.png')
export const avatarUpload = {
  avatar: { name: 'avatar.png', mimeType: 'image/png', buffer: avatarPng },
}

export const EMPTY_PROFILE = {
  firstName: '',
  lastName: '',
  email: '',
  aboutMe: '',
  avatarUrl: '',
}

/** Kontekst bez sesji (nadpisuje `use.storageState` z konfiguracji). */
export const NO_SESSION = { cookies: [], origins: [] }

export function signInRequest(request: APIRequestContext, email: string, password = PASSWORD) {
  return request.post('/api/auth/sign-in/email', {
    headers: { Origin: APP_ORIGIN },
    data: { email, password },
  })
}

export async function loginAs(request: APIRequestContext, email: string, password = PASSWORD) {
  const res = await signInRequest(request, email, password)
  expect(res.status(), `logowanie ${email}`).toBe(200)
}

/** Świeży kontekst przeglądarki zalogowany jako `email` (ciasteczka współdzielone z kontekstem). */
export async function newContextAs(
  browser: Browser,
  email: string,
  password = PASSWORD,
): Promise<BrowserContext> {
  const context = await browser.newContext({ storageState: NO_SESSION, baseURL: APP_ORIGIN })
  await loginAs(context.request, email, password)
  return context
}

/** Wartość nagłówka Cookie z bieżących ciasteczek kontekstu (do testów replay). */
export async function cookieHeader(context: BrowserContext): Promise<string> {
  return (await context.cookies()).map((c) => `${c.name}=${c.value}`).join('; ')
}

export async function resetProfile(request: APIRequestContext) {
  const res = await request.delete('/api/profile')
  expect(res.status(), 'reset profilu').toBe(204)
}

/** Reset profilu A sesją z projektu `setup` — działa też w testach, których fixture `request` nie ma sesji. */
export async function resetProfileA(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL = APP_ORIGIN,
) {
  const a = await playwright.request.newContext({ baseURL, storageState: STORAGE_A })
  await resetProfile(a)
  await a.dispose()
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`
}

const TSX = path.resolve(__dirname, '../../backend/node_modules/.bin/tsx')
const CLI = path.resolve(__dirname, '../../backend/src/cli/user.ts')

/** CLI kont z backendu jako proces, z env przebiegu (MONGODB_URI, BETTER_AUTH_*, PROFILE_DATA_DIR). */
export function userCli(...args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(TSX, [CLI, ...args], { env: process.env })
    let output = ''
    child.stdout.on('data', (d) => (output += d))
    child.stderr.on('data', (d) => (output += d))
    child.on('error', reject)
    child.on('exit', (code) => resolve({ code: code ?? 1, output }))
  })
}
