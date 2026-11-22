import { beforeAll, afterAll, beforeEach, inject } from 'vitest'
import mongoose from 'mongoose'
import { connectDb, disconnectDb } from '../../db/connection.js'
import { ProfileModel } from '../../models/Profile.js'

beforeAll(async () => {
  // env() (np. w getAuth()) wymaga MONGODB_URI w process.env, nie tylko w connectDb.
  process.env.MONGODB_URI = inject('MONGODB_URI')
  await connectDb(process.env.MONGODB_URI)
})

afterAll(async () => {
  await disconnectDb()
})

beforeEach(async () => {
  await ProfileModel.deleteMany({})
  for (const name of ['user', 'session', 'account', 'verification']) {
    await mongoose.connection.db!.collection(name).deleteMany({})
  }
})
