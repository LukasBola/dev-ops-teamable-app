import { describe, it, expect } from 'vitest'
import { parseEnv } from '../env.js'

const valid = {
  MONGODB_URI: 'mongodb://localhost:27017',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:8080',
}

describe('parseEnv', () => {
  it('rzuca bez BETTER_AUTH_SECRET i wymienia go w komunikacie', () => {
    const { BETTER_AUTH_SECRET: _, ...rest } = valid
    expect(() => parseEnv(rest)).toThrow(/BETTER_AUTH_SECRET/)
  })

  it('odrzuca sekret 31-znakowy, akceptuje 32-znakowy', () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_SECRET: 'x'.repeat(31) })).toThrow(
      /BETTER_AUTH_SECRET/,
    )
    expect(parseEnv(valid).BETTER_AUTH_SECRET).toHaveLength(32)
  })

  it('rzuca dla BETTER_AUTH_URL niebędącego URL-em', () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_URL: 'nie-url' })).toThrow(/BETTER_AUTH_URL/)
  })

  it('PORT domyślnie 3001, a z env jest liczbą', () => {
    expect(parseEnv(valid).PORT).toBe(3001)
    expect(parseEnv({ ...valid, PORT: '3000' }).PORT).toBe(3000)
  })

  it('rzuca bez MONGODB_URI', () => {
    const { MONGODB_URI: _, ...rest } = valid
    expect(() => parseEnv(rest)).toThrow(/MONGODB_URI/)
  })
})
