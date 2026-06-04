import { describe, it, expect } from 'vitest'
import { isValidEmail } from './validation'

describe('isValidEmail', () => {
  it('akceptuje poprawny email', () => {
    expect(isValidEmail('jan@example.com')).toBe(true)
  })

  it('odrzuca email bez @', () => {
    expect(isValidEmail('janexample.com')).toBe(false)
  })

  it('odrzuca email bez domeny', () => {
    expect(isValidEmail('jan@')).toBe(false)
  })

  it('odrzuca pusty string', () => {
    expect(isValidEmail('')).toBe(false)
  })

  it('odrzuca email ze spacją', () => {
    expect(isValidEmail('jan kowalski@example.com')).toBe(false)
  })
})
