import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Reguła warstw: services (trwałość profilu) nie zależy od warstwy HTTP ani od kont.
const servicesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'services')
const serviceImports = (): Array<[string, string]> =>
  readdirSync(servicesDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => [f, readFileSync(path.join(servicesDir, f), 'utf8')])

describe('warstwy backendu: services', () => {
  it.each(serviceImports())('%s nie importuje z middleware (warstwa HTTP)', (_f, src) => {
    expect(src).not.toMatch(/from '\.\.\/middleware\//)
  })
})
