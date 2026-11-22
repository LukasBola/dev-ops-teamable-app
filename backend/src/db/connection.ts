import mongoose from 'mongoose'
import { env } from '../env.js'

const DB_NAME = 'teamable'

export async function connectDb(uri: string = env().MONGODB_URI): Promise<void> {
  if (mongoose.connection.readyState >= 1) return
  await mongoose.connect(uri, { dbName: DB_NAME })
}

export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) return
  await mongoose.disconnect()
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1
}
