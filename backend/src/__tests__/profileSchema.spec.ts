import { describe, it, expect } from 'vitest'
import { ProfileInputSchema } from '../schemas/profile.js'

const validBody = {
  firstName: 'Anna',
  lastName: 'Nowak',
  email: 'anna@example.com',
  aboutMe: 'Cześć!',
}

describe('ProfileInputSchema', () => {
  it('akceptuje poprawne body', () => {
    const result = ProfileInputSchema.safeParse(validBody)
    expect(result.success).toBe(true)
  })

  it('akceptuje pusty email (spójność z pustym profilem, FR-9)', () => {
    const result = ProfileInputSchema.safeParse({ ...validBody, email: '' })
    expect(result.success).toBe(true)
  })

  it('odrzuca niepusty, niepoprawny email (FR-12)', () => {
    const result = ProfileInputSchema.safeParse({ ...validBody, email: 'zly-email' })
    expect(result.success).toBe(false)
  })

  it('odcina avatarUrl i nieznane pola (whitelist/strip)', () => {
    const result = ProfileInputSchema.safeParse({
      ...validBody,
      avatarUrl: '/x.png',
      hack: 'usun-mnie',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(validBody)
    }
  })

  it('odrzuca body bez wymaganego pola', () => {
    const { aboutMe: _omitted, ...incomplete } = validBody
    const result = ProfileInputSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })
})
