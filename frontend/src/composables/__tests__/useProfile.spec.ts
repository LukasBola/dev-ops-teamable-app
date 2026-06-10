import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useProfile } from '../useProfile'
import type { Profile } from '../../types/profile'
import { DEFAULT_PROFILE } from '../../types/profile'

const profileFromServer: Profile = {
  firstName: 'Jan',
  lastName: 'Kowalski',
  email: 'jan@example.com',
  aboutMe: 'Cześć!',
  avatarUrl: '',
}

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('useProfile', () => {
  it('inicjuje stan pustym profilem domyślnym', () => {
    const { profile } = useProfile()
    expect(profile.value).toEqual(DEFAULT_PROFILE)
  })

  it('load pobiera profil z serwisu i ustawia stan', async () => {
    fetchMock.mockResolvedValue(okResponse(profileFromServer))
    const { profile, load } = useProfile()
    await load()
    expect(profile.value).toEqual(profileFromServer)
  })

  it('save wysyła profil do serwisu i aktualizuje stan', async () => {
    const updated: Profile = {
      firstName: 'Ola',
      lastName: 'Test',
      email: 'ola@example.com',
      aboutMe: 'x',
      avatarUrl: '',
    }
    fetchMock.mockResolvedValue(okResponse(updated))
    const { profile, save } = useProfile()
    await save(updated)
    expect(profile.value).toEqual(updated)
  })
})
