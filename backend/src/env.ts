import { z } from 'zod'

const schema = z.object({
  MONGODB_URI: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3001),
  // Czytane na żywo w profileStore (testy zmieniają je per test) - tu tylko do walidacji.
  PROFILE_DATA_DIR: z.string().min(1).optional(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  DEMO_USER_EMAIL: z.string().min(1).optional(),
  DEMO_USER_PASSWORD: z.string().min(1).optional(),
})

export type Env = z.infer<typeof schema>

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  // Puste wartości (np. `PROFILE_DATA_DIR=` w .env) traktujemy jak brak.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''))
  const result = schema.safeParse(cleaned)
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Nieprawidłowa konfiguracja środowiska:\n${lines.join('\n')}`)
  }
  return result.data
}

let cached: Env | undefined

export function env(): Env {
  return (cached ??= parseEnv(process.env))
}
