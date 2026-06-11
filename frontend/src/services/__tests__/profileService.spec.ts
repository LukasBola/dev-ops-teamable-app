import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getProfile, saveProfile, uploadAvatar, deleteProfile, ApiError } from '../profileService'
import type { Profile } from '../../types/profile'

const profile: Profile = {
  firstName: 'Anna',
  lastName: 'Nowak',
  email: 'anna@example.com',
  aboutMe: 'Test',
  avatarUrl: '',
}

function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('profileService', () => {
  it('getProfile pobiera profil z GET /api/profile', async () => {
    fetchMock.mockResolvedValue(okResponse(profile))
    expect(await getProfile()).toEqual(profile)
    expect(fetchMock).toHaveBeenCalledWith('/api/profile', undefined)
  })

  it('saveProfile wysyła PUT z JSON-em i zwraca zapisany profil', async () => {
    fetchMock.mockResolvedValue(okResponse(profile))
    expect(await saveProfile(profile)).toEqual(profile)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/profile')
    expect(init!.method).toBe('PUT')
    expect(JSON.parse(init!.body as string)).toEqual(profile)
  })

  it('uploadAvatar wysyła plik jako multipart i zwraca avatarUrl', async () => {
    fetchMock.mockResolvedValue(okResponse({ avatarUrl: '/api/profile/avatar?v=1' }))
    const file = new File(['img'], 'a.png', { type: 'image/png' })
    expect(await uploadAvatar(file)).toEqual({ avatarUrl: '/api/profile/avatar?v=1' })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/profile/avatar')
    expect(init!.method).toBe('POST')
    expect(init!.body).toBeInstanceOf(FormData)
  })

  it('deleteProfile wysyła DELETE', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await deleteProfile()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/profile')
    expect(init!.method).toBe('DELETE')
  })

  it('rzuca ApiError z komunikatem { error } z body przy statusie 4xx', async () => {
    fetchMock.mockResolvedValue(okResponse({ error: 'Niepoprawny adres email' }, 400))
    await expect(saveProfile(profile)).rejects.toMatchObject({
      status: 400,
      message: 'Niepoprawny adres email',
    })
    await expect(saveProfile(profile)).rejects.toBeInstanceOf(ApiError)
  })

  it('rzuca ApiError z generycznym komunikatem przy błędzie sieci', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getProfile()).rejects.toMatchObject({
      status: 0,
      message: 'Backend jest nieosiągalny',
    })
  })
})
