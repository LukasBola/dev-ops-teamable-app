import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Przypięte wersje z CLAUDE.md. Dependabot grupuje te paczki (.github/dependabot.yml), a ten test
// pilnuje, żeby jego PR (albo ręczna aktualizacja) nie rozjechał wersji po cichu.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const json = (file: string) => JSON.parse(readFileSync(path.join(repo, file), 'utf8'))
type Lock = {
  packages: Record<string, { version?: string; dependencies?: Record<string, string> }>
}

describe('przypięte wersje zależności', () => {
  it('better-auth: ta sama dokładna wersja we frontendzie i backendzie', () => {
    const declared = ['backend', 'frontend'].map(
      (p) => json(`${p}/package.json`).dependencies['better-auth'],
    )
    const locked = ['backend', 'frontend'].map(
      (p) => (json(`${p}/package-lock.json`) as Lock).packages['node_modules/better-auth']?.version,
    )
    expect(declared[0], 'zaktualizuj better-auth w obu package.json do tej samej wersji').toBe(
      declared[1],
    )
    expect(locked[0], 'lockfile backendu i frontendu mają różne better-auth').toBe(locked[1])
  })

  it('mongodb: jedna kopia sterownika w backendzie, zgodna z mongoose (ADR-0007)', () => {
    const lock = json('backend/package-lock.json') as Lock
    const copies = Object.entries(lock.packages)
      .filter(([key]) => /(^|\/)node_modules\/mongodb$/.test(key))
      .map(([key, pkg]) => `${key}@${pkg.version}`)
    const wanted = lock.packages['node_modules/mongoose']?.dependencies?.mongodb
    expect(
      copies,
      `mongoose wymaga mongodb ${wanted}: ustaw ten zakres w backend/package.json i odśwież lockfile`,
    ).toHaveLength(1)
  })
})
