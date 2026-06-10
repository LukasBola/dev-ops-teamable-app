import { describe, it, expect, beforeEach } from 'vitest'
import { useProfile } from '../useProfile'
import { getProfile } from '../../services/profileService'
import type { Profile } from '../../types/profile'

describe('useProfile', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('inicjuje stan profilem z serwisu', () => {
    const { profile } = useProfile()
    expect(profile.value.firstName).toBe('Jan')
  })

  it('save aktualizuje stan i utrwala dane', () => {
    const { profile, save } = useProfile()
    const updated: Profile = {
      firstName: 'Ola',
      lastName: 'Test',
      email: 'ola@example.com',
      aboutMe: 'x',
      avatarUrl: '',
    }
    save(updated)
    expect(profile.value).toEqual(updated)
    expect(getProfile()).toEqual(updated)
  })
})
