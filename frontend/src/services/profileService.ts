import type { Profile } from '../types/profile'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

// Single predictable error contract for layers above (spec 4):
// HTTP 4xx/5xx → ApiError with { error } from body; network error → ApiError(0).
async function request(path: string, init?: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, init)
  } catch {
    throw new ApiError(0, 'Backend jest nieosiągalny')
  }
  if (!response.ok) {
    let message = 'Błąd serwera'
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // body was not JSON — keep generic message
    }
    throw new ApiError(response.status, message)
  }
  return response
}

export async function getProfile(): Promise<Profile> {
  const response = await request('/api/profile')
  return response.json()
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const response = await request('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  })
  return response.json()
}

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const formData = new FormData()
  formData.append('avatar', file)
  const response = await request('/api/profile/avatar', {
    method: 'POST',
    body: formData,
  })
  return response.json()
}

export async function deleteProfile(): Promise<void> {
  await request('/api/profile', { method: 'DELETE' })
}
