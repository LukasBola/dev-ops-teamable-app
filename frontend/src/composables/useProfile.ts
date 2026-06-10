import { ref } from 'vue'
import { getProfile, saveProfile } from '../services/profileService'
import type { Profile } from '../types/profile'

export function useProfile() {
  const profile = ref<Profile>(getProfile())

  function save(updated: Profile): void {
    saveProfile(updated)
    profile.value = { ...updated }
  }

  return { profile, save }
}
