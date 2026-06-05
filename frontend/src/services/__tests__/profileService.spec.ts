import { describe, it, expect, beforeEach } from 'vitest'
import { getProfile, saveProfile, STORAGE_KEY } from '../profileService'
import { DEFAULT_PROFILE, type Profile } from '../../types/profile'

describe('profileService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('zwraca domyślny profil (seed), gdy localStorage jest pusty', () => {
    expect(getProfile()).toEqual(DEFAULT_PROFILE)
  })

  it('zapisuje i odczytuje profil', () => {
    const updated: Profile = {
      firstName: 'Anna',
      lastName: 'Nowak',
      email: 'anna@example.com',
      aboutMe: 'Test',
      avatarUrl: 'data:image/png;base64,abc',
    }
    saveProfile(updated)
    expect(getProfile()).toEqual(updated)
  })

  it('zwraca seed, gdy zapis w localStorage jest uszkodzony', () => {
    localStorage.setItem(STORAGE_KEY, 'to-nie-jest-json')
    expect(getProfile()).toEqual(DEFAULT_PROFILE)
  })
})
