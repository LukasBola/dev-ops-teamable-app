import { ref } from 'vue'
import { ApiError, getProfile, saveProfile, uploadAvatar } from '../services/profileService'
import { DEFAULT_PROFILE, type Profile } from '../types/profile'

export function useProfile(options: { onUnauthorized?: () => void } = {}) {
  const profile = ref<Profile>({ ...DEFAULT_PROFILE })
  const loading = ref(true)
  const error = ref('')
  // Numer bieżącego ładowania: odpowiedź sprzed clear() (np. poprzedniego użytkownika) jest odrzucana.
  let ticket = 0

  async function load(): Promise<void> {
    const mine = ++ticket
    loading.value = true
    error.value = ''
    try {
      const loaded = await getProfile()
      if (mine === ticket) profile.value = loaded
    } catch (e) {
      if (mine !== ticket) return
      if (e instanceof ApiError && e.status === 401) options.onUnauthorized?.()
      else error.value = e instanceof Error ? e.message : 'Nie udało się wczytać profilu.'
    } finally {
      if (mine === ticket) loading.value = false
    }
  }

  /** Czyści dane z pamięci SPA (wylogowanie, zmiana użytkownika). */
  function clear(): void {
    ticket++
    profile.value = { ...DEFAULT_PROFILE }
    loading.value = true
    error.value = ''
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

  return { profile, loading, error, save, load, clear }
}
