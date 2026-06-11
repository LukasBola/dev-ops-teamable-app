// Start backendu pod E2E (port 3101, jednorazowy katalog danych) — używany przez
// `webServer` Playwrighta. Jest samowystarczalny: gdy MONGODB_URI NIE jest ustawione
// (np. klik „play" na pojedynczym teście w IDE albo `npx playwright test` wprost),
// sam podnosi dev MongoDB przez docker compose i używa OSOBNEJ bazy `teamable_e2e`,
// żeby nie ruszać danych dev (baza `teamable`). Gdy uruchamia to orkiestrator
// (`make e2e`), MONGODB_URI jest już wstrzyknięte (testcontainer) → ten blok jest
// pomijany, a baza pozostaje domyślna.
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// E2E zawsze odizolowane od dev: dedykowany port + jednorazowy katalog danych.
process.env.PORT = '3101'
process.env.PROFILE_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'teamable-e2e-'))

if (!process.env.MONGODB_URI) {
  console.log('[start-e2e] MONGODB_URI nieustawione — podnoszę dev MongoDB (docker compose)…')
  const up = spawnSync('docker', ['compose', 'up', '-d', '--wait'], { stdio: 'inherit' })
  if (up.status !== 0) {
    console.error('[start-e2e] `docker compose up` nie powiodło się — czy Docker działa?')
    process.exit(1)
  }
  process.env.MONGODB_URI = 'mongodb://localhost:27017'
  process.env.MONGODB_DB_NAME = 'teamable_e2e'

  const migrated = spawnSync('node', ['scripts/migrate.cjs', 'up'], { stdio: 'inherit' })
  if (migrated.status !== 0) {
    console.error('[start-e2e] migracje nie powiodły się')
    process.exit(1)
  }
}

// Przekazanie sterowania do właściwego bootstrapu (index.ts uruchamia main() przy imporcie).
await import('../src/index.js')
