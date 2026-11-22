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
  userUploadsDir,
} from '../services/profileStore.js'
import { EMPTY_PROFILE } from '../types/profile.js'

// Profile state is reset by shared setup (deleteMany). Here we isolate the avatar dir.
let dataDir: string
const A = 'user-a'
const B = 'user-b'

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

describe('profileStore (MongoDB)', () => {
  it('readProfile zwraca pusty profil, gdy brak dokumentu (FR-9)', async () => {
    expect(await readProfile(A)).toEqual(EMPTY_PROFILE)
  })

  it('writeProfile zapisuje i readProfile odczytuje (FR-8)', async () => {
    await writeProfile(A, input)
    expect(await readProfile(A)).toEqual({ ...input, avatarUrl: '' })
  })

  it('writeProfile zachowuje istniejący avatarUrl', async () => {
    await saveAvatar(A, Buffer.from('img'), 'png')
    const before = await readProfile(A)
    expect(before.avatarUrl).toMatch(/^\/api\/profile\/avatar\?v=\d+$/)

    await writeProfile(A, input)
    const after = await readProfile(A)
    expect(after.avatarUrl).toBe(before.avatarUrl)
  })

  it('saveAvatar usuwa poprzedni plik o innym rozszerzeniu (FR-11, brak sierot)', async () => {
    await saveAvatar(A, Buffer.from('png-img'), 'png')
    await saveAvatar(A, Buffer.from('jpg-img'), 'jpg')
    const files = await fs.readdir(path.join(dataDir, 'uploads', A))
    expect(files).toEqual(['avatar.jpg'])
  })

  it('findAvatarPath zwraca null bez uploadu i ścieżkę po uploadzie', async () => {
    expect(await findAvatarPath(A)).toBeNull()
    await saveAvatar(A, Buffer.from('img'), 'png')
    expect(await findAvatarPath(A)).toBe(path.join(dataDir, 'uploads', A, 'avatar.png'))
  })

  it('deleteProfile czyści dokument + plik i jest idempotentny (FR-13)', async () => {
    await writeProfile(A, input)
    await saveAvatar(A, Buffer.from('img'), 'png')
    await deleteProfile(A)
    expect(await readProfile(A)).toEqual(EMPTY_PROFILE)
    expect(await findAvatarPath(A)).toBeNull()
    await expect(deleteProfile(A)).resolves.toBeUndefined()
  })

  it('profile użytkowników są rozdzielone (FR-18)', async () => {
    await writeProfile(A, input)
    await saveAvatar(A, Buffer.from('img'), 'png')
    expect(await readProfile(B)).toEqual(EMPTY_PROFILE)
    expect(await findAvatarPath(B)).toBeNull()
  })

  it('deleteProfile(A) nie rusza avatara ani profilu B (Review Focus 5)', async () => {
    await writeProfile(B, input)
    await saveAvatar(A, Buffer.from('a'), 'png')
    await saveAvatar(B, Buffer.from('b'), 'png')
    await deleteProfile(A)
    expect(await findAvatarPath(B)).toBe(path.join(dataDir, 'uploads', B, 'avatar.png'))
    expect((await readProfile(B)).firstName).toBe('Anna')
  })

  it('userUploadsDir(poprawne id) → katalog użytkownika w uploads', () => {
    expect(userUploadsDir('6650f1a2b3c4d5e6f7a8b9c0')).toBe(
      path.join(dataDir, 'uploads', '6650f1a2b3c4d5e6f7a8b9c0'),
    )
  })

  it.each(['../etc', 'a/b', '', '.', 'x'.repeat(65)])(
    'userUploadsDir(%j) rzuca (ochrona przed path traversal)',
    (bad) => {
      expect(() => userUploadsDir(bad)).toThrow()
    },
  )
})
