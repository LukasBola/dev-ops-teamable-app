import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  readProfile,
  writeProfile,
  saveAvatar,
  findAvatarPath,
  deleteProfile,
} from '../services/profileStore.js'
import { EMPTY_PROFILE } from '../types/profile.js'

let dataDir: string

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'teamable-store-'))
  process.env.PROFILE_DATA_DIR = dataDir
})

afterEach(async () => {
  delete process.env.PROFILE_DATA_DIR
  await fs.rm(dataDir, { recursive: true, force: true })
})

const input = {
  firstName: 'Anna',
  lastName: 'Nowak',
  email: 'anna@example.com',
  aboutMe: 'Cześć!',
}

describe('profileStore', () => {
  it('readProfile zwraca pusty profil, gdy plik nie istnieje (FR-9)', async () => {
    expect(await readProfile()).toEqual(EMPTY_PROFILE)
  })

  it('readProfile zwraca pusty profil, gdy plik jest uszkodzony', async () => {
    await fs.writeFile(path.join(dataDir, 'profile.json'), 'nie-json', 'utf8')
    expect(await readProfile()).toEqual(EMPTY_PROFILE)
  })

  it('writeProfile zapisuje i readProfile odczytuje (FR-8)', async () => {
    await writeProfile(input)
    expect(await readProfile()).toEqual({ ...input, avatarUrl: '' })
  })

  it('writeProfile zachowuje istniejący avatarUrl', async () => {
    await saveAvatar(Buffer.from('img'), 'png')
    const before = await readProfile()
    expect(before.avatarUrl).toMatch(/^\/api\/profile\/avatar\?v=\d+$/)

    await writeProfile(input)
    const after = await readProfile()
    expect(after.avatarUrl).toBe(before.avatarUrl)
  })

  it('writeProfile zapisuje atomowo (brak pliku .tmp po zapisie)', async () => {
    await writeProfile(input)
    const files = await fs.readdir(dataDir)
    expect(files).toContain('profile.json')
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false)
  })

  it('saveAvatar usuwa poprzedni plik o innym rozszerzeniu (FR-11, brak sierot)', async () => {
    await saveAvatar(Buffer.from('png-img'), 'png')
    await saveAvatar(Buffer.from('jpg-img'), 'jpg')
    const files = await fs.readdir(path.join(dataDir, 'uploads'))
    expect(files).toEqual(['avatar.jpg'])
  })

  it('findAvatarPath zwraca null bez uploadu i ścieżkę po uploadzie', async () => {
    expect(await findAvatarPath()).toBeNull()
    await saveAvatar(Buffer.from('img'), 'png')
    expect(await findAvatarPath()).toBe(path.join(dataDir, 'uploads', 'avatar.png'))
  })

  it('deleteProfile czyści dane i jest idempotentny (FR-13)', async () => {
    await writeProfile(input)
    await saveAvatar(Buffer.from('img'), 'png')
    await deleteProfile()
    expect(await readProfile()).toEqual(EMPTY_PROFILE)
    expect(await findAvatarPath()).toBeNull()
    await expect(deleteProfile()).resolves.toBeUndefined() // drugi raz też OK
  })
})
