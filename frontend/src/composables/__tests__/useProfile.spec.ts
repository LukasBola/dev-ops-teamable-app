import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useProfile } from '../useProfile'
import { ApiError, getProfile, saveProfile, uploadAvatar } from '../../services/profileService'
import { DEFAULT_PROFILE, type Profile } from '../../types/profile'

vi.mock('../../services/profileService', async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import('../../services/profileService')>()).ApiError,
  getProfile: vi.fn<() => Promise<Profile>>(),
  saveProfile: vi.fn<(profile: Profile) => Promise<Profile>>(),
  uploadAvatar: vi.fn<(file: File) => Promise<{ avatarUrl: string }>>(),
}))

const remote: Profile = {
  firstName: 'Anna',
  lastName: 'Nowak',
  email: 'anna@example.com',
  aboutMe: 'Z backendu',
  avatarUrl: '',
}

beforeEach(() => {
  vi.mocked(getProfile).mockReset()
  vi.mocked(saveProfile).mockReset()
  vi.mocked(uploadAvatar).mockReset()
})

describe('useProfile', () => {
  it('ładuje profil z serwisu i kończy loading', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    const { profile, loading, error, load } = useProfile()
    expect(loading.value).toBe(true)
    await load()
    expect(loading.value).toBe(false)
    expect(error.value).toBe('')
    expect(profile.value).toEqual(remote)
  })

  it('ustawia error, gdy load się nie powiedzie', async () => {
    vi.mocked(getProfile).mockRejectedValue(new Error('Backend jest nieosiągalny'))
    const { loading, error, load } = useProfile()
    await load()
    expect(loading.value).toBe(false)
    expect(error.value).toBe('Backend jest nieosiągalny')
  })

  it('save bez zdjęcia woła saveProfile i aktualizuje stan', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    const updated = { ...remote, firstName: 'Ola' }
    vi.mocked(saveProfile).mockResolvedValue(updated)

    const { profile, save, load } = useProfile()
    await load()
    await save(updated, null)

    expect(uploadAvatar).not.toHaveBeenCalled()
    expect(saveProfile).toHaveBeenCalledWith(updated)
    expect(profile.value).toEqual(updated)
  })

  it('save ze zdjęciem: najpierw upload, potem PUT z nowym avatarUrl', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    vi.mocked(uploadAvatar).mockResolvedValue({ avatarUrl: '/api/profile/avatar?v=42' })
    const saved = { ...remote, avatarUrl: '/api/profile/avatar?v=42' }
    vi.mocked(saveProfile).mockResolvedValue(saved)

    const { profile, save, load } = useProfile()
    await load()
    const file = new File(['img'], 'a.png', { type: 'image/png' })
    await save({ ...remote }, file)

    expect(uploadAvatar).toHaveBeenCalledWith(file)
    expect(saveProfile).toHaveBeenCalledWith(saved)
    expect(profile.value.avatarUrl).toBe('/api/profile/avatar?v=42')
  })

  it('save propaguje błąd uploadu i NIE woła saveProfile (spec 4)', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    vi.mocked(uploadAvatar).mockRejectedValue(new Error('Plik jest za duży (max 2 MB)'))

    const { save, load } = useProfile()
    await load()
    const file = new File(['img'], 'big.png', { type: 'image/png' })

    await expect(save({ ...remote }, file)).rejects.toThrow('Plik jest za duży (max 2 MB)')
    expect(saveProfile).not.toHaveBeenCalled()
  })

  it('nie ładuje profilu sam z siebie - dopiero po zalogowaniu (FR-15)', () => {
    useProfile()
    expect(getProfile).not.toHaveBeenCalled()
  })

  it('clear() resetuje profil, błąd i wraca do stanu ładowania', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    const { profile, loading, error, load, clear } = useProfile()
    await load()
    clear()
    expect(profile.value).toEqual(DEFAULT_PROFILE)
    expect(loading.value).toBe(true)
    expect(error.value).toBe('')
  })

  it('odpowiedź poprzedniego ładowania po clear() jest ignorowana (zmiana użytkownika)', async () => {
    let resolveA!: (p: Profile) => void
    vi.mocked(getProfile).mockReturnValueOnce(new Promise((r) => (resolveA = r)))
    const { profile, load, clear } = useProfile()
    const pendingA = load()
    clear()
    resolveA(remote)
    await pendingA
    expect(profile.value).toEqual(DEFAULT_PROFILE)
  })

  it('401 przy ładowaniu woła onUnauthorized i nie pokazuje błędu', async () => {
    vi.mocked(getProfile).mockRejectedValue(new ApiError(401, 'Wymagane logowanie'))
    const onUnauthorized = vi.fn<() => void>()
    const { error, load } = useProfile({ onUnauthorized })
    await load()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(error.value).toBe('')
  })
})
