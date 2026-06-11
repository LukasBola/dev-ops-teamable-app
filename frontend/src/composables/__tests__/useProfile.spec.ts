import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useProfile } from '../useProfile'
import { getProfile, saveProfile, uploadAvatar } from '../../services/profileService'
import type { Profile } from '../../types/profile'

vi.mock('../../services/profileService', () => ({
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

async function flush() {
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  vi.mocked(getProfile).mockReset()
  vi.mocked(saveProfile).mockReset()
  vi.mocked(uploadAvatar).mockReset()
})

describe('useProfile', () => {
  it('ładuje profil z serwisu i kończy loading', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    const { profile, loading, error } = useProfile()
    expect(loading.value).toBe(true)
    await flush()
    expect(loading.value).toBe(false)
    expect(error.value).toBe('')
    expect(profile.value).toEqual(remote)
  })

  it('ustawia error, gdy load się nie powiedzie', async () => {
    vi.mocked(getProfile).mockRejectedValue(new Error('Backend jest nieosiągalny'))
    const { loading, error } = useProfile()
    await flush()
    expect(loading.value).toBe(false)
    expect(error.value).toBe('Backend jest nieosiągalny')
  })

  it('save bez zdjęcia woła saveProfile i aktualizuje stan', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    const updated = { ...remote, firstName: 'Ola' }
    vi.mocked(saveProfile).mockResolvedValue(updated)

    const { profile, save } = useProfile()
    await flush()
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

    const { profile, save } = useProfile()
    await flush()
    const file = new File(['img'], 'a.png', { type: 'image/png' })
    await save({ ...remote }, file)

    expect(uploadAvatar).toHaveBeenCalledWith(file)
    expect(saveProfile).toHaveBeenCalledWith(saved)
    expect(profile.value.avatarUrl).toBe('/api/profile/avatar?v=42')
  })

  it('save propaguje błąd uploadu i NIE woła saveProfile (spec 4)', async () => {
    vi.mocked(getProfile).mockResolvedValue(remote)
    vi.mocked(uploadAvatar).mockRejectedValue(new Error('Plik jest za duży (max 2 MB)'))

    const { save } = useProfile()
    await flush()
    const file = new File(['img'], 'big.png', { type: 'image/png' })

    await expect(save({ ...remote }, file)).rejects.toThrow('Plik jest za duży (max 2 MB)')
    expect(saveProfile).not.toHaveBeenCalled()
  })
})
