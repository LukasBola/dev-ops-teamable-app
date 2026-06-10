import { ref } from 'vue'
import { getProfile, saveProfile } from '../services/profileService'
import { DEFAULT_PROFILE } from '../types/profile'
import type { Profile } from '../types/profile'

export function useProfile() {
  const profile = ref<Profile>({ ...DEFAULT_PROFILE })

  async function load(): Promise<void> {
    profile.value = await getProfile()
  }

  async function save(updated: Profile): Promise<void> {
    await saveProfile(updated)
    profile.value = { ...updated }
  }

  return { profile, load, save }
}
