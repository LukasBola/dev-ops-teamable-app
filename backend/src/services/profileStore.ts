import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Profile } from '../types/profile.js'
import { EMPTY_PROFILE } from '../types/profile.js'
import type { ProfileInput } from '../schemas/profile.js'
import { ProfileModel, type ProfileDoc } from '../models/Profile.js'

// --- Avatar still on disk (as in Etap 2) ---
const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_DATA_DIR = path.resolve(moduleDir, '../../data')
function dataDir(): string {
  return process.env.PROFILE_DATA_DIR || DEFAULT_DATA_DIR
}
export const uploadsRoot = () => path.join(dataDir(), 'uploads')
const USER_ID = /^[A-Za-z0-9_-]{1,64}$/

/** Katalog avatara użytkownika; id spoza wzorca (np. `../etc`) nie może wyjść poza uploads. */
export function userUploadsDir(userId: string): string {
  // userId pochodzi z sesji/bazy, nie od klienta — zły format to błąd serwera (500), nie 400.
  if (!USER_ID.test(userId)) throw new Error('Niepoprawny identyfikator użytkownika')
  return path.join(uploadsRoot(), userId)
}

// --- Map Mongo document -> Profile contract (without _id) ---
function toProfile(doc: ProfileDoc | null): Profile {
  if (!doc) return { ...EMPTY_PROFILE }
  return {
    firstName: doc.firstName,
    lastName: doc.lastName,
    email: doc.email,
    aboutMe: doc.aboutMe,
    avatarUrl: doc.avatarUrl,
  }
}

export async function readProfile(userId: string): Promise<Profile> {
  const doc = await ProfileModel.findById(userId).lean<ProfileDoc | null>().exec()
  return toProfile(doc)
}

export async function writeProfile(userId: string, input: ProfileInput): Promise<Profile> {
  // $set only text fields → avatarUrl untouched (FR-8). Atomicity = one findByIdAndUpdate.
  const doc = await ProfileModel.findByIdAndUpdate(
    userId,
    { $set: { ...input } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  )
    .lean<ProfileDoc | null>()
    .exec()
  if (!doc) throw new Error('writeProfile: upsert returned null — this should never happen')
  return toProfile(doc)
}

export async function findAvatarPath(userId: string): Promise<string | null> {
  const dir = userUploadsDir(userId)
  try {
    const files = await fs.readdir(dir)
    const name = files.find((f) => f.startsWith('avatar.'))
    return name ? path.join(dir, name) : null
  } catch {
    return null
  }
}

export async function saveAvatar(userId: string, buffer: Buffer, ext: string): Promise<string> {
  const dir = userUploadsDir(userId)
  await fs.mkdir(dir, { recursive: true })
  const previous = await findAvatarPath(userId)
  if (previous) await fs.rm(previous, { force: true })
  await fs.writeFile(path.join(dir, `avatar.${ext}`), buffer)

  // ?v= cache-busting; avatarUrl now stored in Mongo document.
  const avatarUrl = `/api/profile/avatar?v=${Date.now()}`
  await ProfileModel.findByIdAndUpdate(
    userId,
    { $set: { avatarUrl } },
    { upsert: true, setDefaultsOnInsert: true },
  ).exec()
  return avatarUrl
}

export async function deleteProfile(userId: string): Promise<void> {
  const dir = userUploadsDir(userId)
  await ProfileModel.deleteOne({ _id: userId }).exec()
  await fs.rm(dir, { recursive: true, force: true })
}
