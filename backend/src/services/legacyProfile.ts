import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ProfileModel, LEGACY_PROFILE_ID, type ProfileDoc } from '../models/Profile.js'
import { uploadsRoot, userUploadsDir } from './profileStore.js'

/**
 * Przenosi profil sprzed kont (`_id: 'profile'`, avatar w `uploads/avatar.*`) na konto `userId`.
 * Kolejność chroni dane: najpierw zapis profilu, potem plik, na końcu usunięcie singletonu -
 * przerwanie w połowie zostawia singleton, więc ponowne `create` dokończy przejęcie.
 */
export async function adoptLegacyProfile(userId: string): Promise<boolean> {
  const legacy = await ProfileModel.findById(LEGACY_PROFILE_ID).lean<ProfileDoc | null>().exec()
  if (!legacy) return false

  const entries = await fs.readdir(uploadsRoot(), { withFileTypes: true }).catch(() => [])
  const avatar = entries.find((e) => e.isFile() && e.name.startsWith('avatar.'))?.name

  const { firstName, lastName, email, aboutMe } = legacy
  await ProfileModel.replaceOne(
    { _id: userId },
    {
      firstName,
      lastName,
      email,
      aboutMe,
      // Bez pliku stary avatarUrl prowadziłby donikąd.
      avatarUrl: avatar ? `/api/profile/avatar?v=${Date.now()}` : '',
    },
    { upsert: true },
  ).exec()

  if (avatar) {
    const dir = userUploadsDir(userId)
    await fs.mkdir(dir, { recursive: true })
    await fs.rename(path.join(uploadsRoot(), avatar), path.join(dir, avatar))
  }
  await ProfileModel.deleteOne({ _id: LEGACY_PROFILE_ID }).exec()
  return true
}
