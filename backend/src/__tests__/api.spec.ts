import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { createApp } from '../app.js'
import { EMPTY_PROFILE } from '../types/profile.js'

let dataDir: string
const app = createApp()

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'teamable-api-'))
  process.env.PROFILE_DATA_DIR = dataDir
})

afterEach(async () => {
  delete process.env.PROFILE_DATA_DIR
  await fs.rm(dataDir, { recursive: true, force: true })
})

const validBody = {
  firstName: 'Anna',
  lastName: 'Nowak',
  email: 'anna@example.com',
  aboutMe: 'Cześć!',
}

describe('GET /api/profile', () => {
  it('zwraca pusty profil na czystym stanie (FR-9)', async () => {
    const res = await request(app).get('/api/profile')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(EMPTY_PROFILE)
  })

  it('test kontraktowy: odpowiedź ma dokładnie pola Profile', async () => {
    const res = await request(app).get('/api/profile')
    expect(Object.keys(res.body).sort()).toEqual([
      'aboutMe',
      'avatarUrl',
      'email',
      'firstName',
      'lastName',
    ])
  })
})

describe('PUT /api/profile', () => {
  it('zapisuje poprawne body i zwraca pełny profil (FR-8)', async () => {
    const res = await request(app).put('/api/profile').send(validBody)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ...validBody, avatarUrl: '' })

    const get = await request(app).get('/api/profile')
    expect(get.body).toEqual({ ...validBody, avatarUrl: '' })
  })

  it('odrzuca niepoprawny email z 400 i formatem { error } (FR-12)', async () => {
    const res = await request(app)
      .put('/api/profile')
      .send({ ...validBody, email: 'zly-email' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Niepoprawny adres email' })

    const get = await request(app).get('/api/profile')
    expect(get.body).toEqual(EMPTY_PROFILE) // nic nie zapisano
  })

  it('akceptuje pusty email (FR-9)', async () => {
    const res = await request(app)
      .put('/api/profile')
      .send({ ...validBody, email: '' })
    expect(res.status).toBe(200)
  })

  it('ignoruje avatarUrl i nieznane pola w body (whitelist)', async () => {
    const res = await request(app)
      .put('/api/profile')
      .send({ ...validBody, avatarUrl: '/oszukany.png', hack: 1 })
    expect(res.status).toBe(200)
    expect(res.body.avatarUrl).toBe('')
    expect(res.body).not.toHaveProperty('hack')
  })

  it('odrzuca body bez wymaganego pola z 400', async () => {
    const res = await request(app).put('/api/profile').send({ firstName: 'X' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Niepoprawne dane profilu' })
  })
})

describe('DELETE /api/profile', () => {
  it('resetuje profil do pustego i jest idempotentny (FR-13)', async () => {
    await request(app).put('/api/profile').send(validBody)

    const del = await request(app).delete('/api/profile')
    expect(del.status).toBe(204)

    const get = await request(app).get('/api/profile')
    expect(get.body).toEqual(EMPTY_PROFILE)

    const delAgain = await request(app).delete('/api/profile')
    expect(delAgain.status).toBe(204)
  })
})
