import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import mongoose from 'mongoose'
import { env } from '../env.js'

export const PASSWORD_LENGTH = { min: 8, max: 128 } as const

function createAuth() {
  const db = mongoose.connection.db
  if (!db) throw new Error('Better Auth: brak połączenia z bazą danych')
  return betterAuth({
    secret: env().BETTER_AUTH_SECRET,
    baseURL: env().BETTER_AUTH_URL,
    // Bez `client` = bez transakcji (standalone mongo:7 w compose).
    database: mongodbAdapter(db),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_LENGTH.min,
      maxPasswordLength: PASSWORD_LENGTH.max,
    },
    advanced: { ipAddress: { ipAddressHeaders: ['x-real-ip'] } },
  })
}

export type Auth = ReturnType<typeof createAuth>

let instance: Auth | undefined

/** Leniwie, bo `createApp()` bywa wołane przed `connectDb()`. */
export function getAuth(): Auth {
  return (instance ??= createAuth())
}
