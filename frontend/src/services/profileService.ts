import { DEFAULT_PROFILE, type Profile } from '../types/profile'

export const STORAGE_KEY = 'teamable.profile'

export function getProfile(): Profile {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { ...DEFAULT_PROFILE }
  try {
    return JSON.parse(raw) as Profile
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

export function saveProfile(profile: Profile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}
