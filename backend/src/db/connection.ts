import mongoose from 'mongoose'

// Nazwa bazy domyślnie 'teamable'; nadpisywalna przez MONGODB_DB_NAME, żeby np.
// E2E mogło użyć osobnej bazy (teamable_e2e) w tej samej instancji co dev — bez
// dotykania danych dev. Migrate-mongo czyta tę samą zmienną (scripts/migrate.cjs).
const DEFAULT_DB_NAME = 'teamable'

export async function connectDb(uri: string | undefined = process.env.MONGODB_URI): Promise<void> {
  if (!uri) throw new Error('MONGODB_URI is not set')
  if (mongoose.connection.readyState >= 1) return
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME ?? DEFAULT_DB_NAME })
}

export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) return
  await mongoose.disconnect()
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1
}
