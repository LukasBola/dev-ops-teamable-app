import { ref } from 'vue'
import { getProfile, saveProfile, uploadAvatar } from '../services/profileService'
import { DEFAULT_PROFILE, type Profile } from '../types/profile'

export function useProfile() {
  const profile = ref<Profile>({ ...DEFAULT_PROFILE })
  const loading = ref(true)
  const error = ref('')

  async function load(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      profile.value = await getProfile()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Nie udało się wczytać profilu.'
    } finally {
      loading.value = false
    }
  }

  // Order (spec 4): upload first, then PUT fields.
  // Upload error aborts save (throws) — profile doesn't change partially.
  async function save(updated: Profile, avatarFile: File | null = null): Promise<void> {
    const next: Profile = { ...updated }
    if (avatarFile) {
      const { avatarUrl } = await uploadAvatar(avatarFile)
      next.avatarUrl = avatarUrl
    }
    profile.value = await saveProfile(next)
  }

  void load()

  return { profile, loading, error, save, reload: load }
}
