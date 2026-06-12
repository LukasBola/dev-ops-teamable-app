import { beforeAll, afterAll, beforeEach, inject } from 'vitest'
import { connectDb, disconnectDb } from '../../db/connection.js'
import { ProfileModel } from '../../models/Profile.js'

beforeAll(async () => {
  await connectDb(inject('MONGODB_URI'))
})

afterAll(async () => {
  await disconnectDb()
})

beforeEach(async () => {
  await ProfileModel.deleteMany({})
})
