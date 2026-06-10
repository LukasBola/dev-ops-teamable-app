import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Profile } from '../types/profile.js'
import { EMPTY_PROFILE } from '../types/profile.js'
import type { ProfileInput } from '../schemas/profile.js'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_DATA_DIR = path.resolve(moduleDir, '../../data')

// Read at each call (not once on import), so tests and E2E can swap dir via env.
function dataDir(): string {
  return process.env.PROFILE_DATA_DIR || DEFAULT_DATA_DIR
}

const profilePath = () => path.join(dataDir(), 'profile.json')
const uploadsDir = () => path.join(dataDir(), 'uploads')

export async function readProfile(): Promise<Profile> {
  try {
    const raw = await fs.readFile(profilePath(), 'utf8')
    return { ...EMPTY_PROFILE, ...JSON.parse(raw) }
  } catch {
    return { ...EMPTY_PROFILE }
  }
}

// Atomic write: temp + rename. rename is atomic within the filesystem,
// so a crash mid-write never leaves a truncated JSON file.
async function writeJson(profile: Profile): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true })
  const tmp = `${profilePath()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(profile, null, 2), 'utf8')
  await fs.rename(tmp, profilePath())
}

export async function writeProfile(input: ProfileInput): Promise<Profile> {
  const existing = await readProfile()
  const profile: Profile = { ...input, avatarUrl: existing.avatarUrl }
  await writeJson(profile)
  return profile
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

  // ?v= cache-busting: a fixed path would be cached by the browser
  const avatarUrl = `/api/profile/avatar?v=${Date.now()}`
  const existing = await readProfile()
  await writeJson({ ...existing, avatarUrl })
  return avatarUrl
}

export async function deleteProfile(): Promise<void> {
  await fs.rm(profilePath(), { force: true })
  await fs.rm(uploadsDir(), { recursive: true, force: true })
}
