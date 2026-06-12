import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Profile } from '../types/profile.js'
import { EMPTY_PROFILE } from '../types/profile.js'
import type { ProfileInput } from '../schemas/profile.js'
import { ProfileModel, PROFILE_ID, type ProfileDoc } from '../models/Profile.js'

// --- Avatar still on disk (as in Etap 2) ---
const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_DATA_DIR = path.resolve(moduleDir, '../../data')
function dataDir(): string {
  return process.env.PROFILE_DATA_DIR || DEFAULT_DATA_DIR
}
const uploadsDir = () => path.join(dataDir(), 'uploads')

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

export async function readProfile(): Promise<Profile> {
  const doc = await ProfileModel.findById(PROFILE_ID).lean<ProfileDoc | null>().exec()
  return toProfile(doc)
}

export async function writeProfile(input: ProfileInput): Promise<Profile> {
  // $set only text fields → avatarUrl untouched (FR-8). Atomicity = one findByIdAndUpdate.
  const doc = await ProfileModel.findByIdAndUpdate(
    PROFILE_ID,
    { $set: { ...input } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  )
    .lean<ProfileDoc | null>()
    .exec()
  if (!doc) throw new Error('writeProfile: upsert returned null — this should never happen')
  return toProfile(doc)
}

export async function findAvatarPath(): Promise<string | null> {
  try {
    const files = await fs.readdir(uploadsDir())
    const name = files.find((f) => f.startsWith('avatar.'))
    return name ? path.join(uploadsDir(), name) : null
  } catch {
    return null
  }
}

export async function saveAvatar(buffer: Buffer, ext: string): Promise<string> {
  await fs.mkdir(uploadsDir(), { recursive: true })
  const previous = await findAvatarPath()
  if (previous) await fs.rm(previous, { force: true })
  await fs.writeFile(path.join(uploadsDir(), `avatar.${ext}`), buffer)

  // ?v= cache-busting; avatarUrl now stored in Mongo document.
  const avatarUrl = `/api/profile/avatar?v=${Date.now()}`
  await ProfileModel.findByIdAndUpdate(
    PROFILE_ID,
    { $set: { avatarUrl } },
    { upsert: true, setDefaultsOnInsert: true },
  ).exec()
  return avatarUrl
}

export async function deleteProfile(): Promise<void> {
  await ProfileModel.deleteOne({ _id: PROFILE_ID }).exec()
  await fs.rm(uploadsDir(), { recursive: true, force: true })
}
