import os from 'node:os'
import path from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { MongoDBContainer } from '@testcontainers/mongodb'

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', env })
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`)),
    )
    child.on('error', reject)
  })
}

async function main() {
  const container = await new MongoDBContainer('mongo:7').start()
  // Everything after start() lives in the try so the finally always stops the
  // container (and cleans the temp dir) even if setup below throws.
  let legacyDir: string | undefined
  let dataDir: string | undefined
  try {
    // Append directConnection=true so Mongoose bypasses replica-set topology
    // discovery (testcontainers/mongodb enables RS mode; the RS member advertises
    // its internal Docker hostname, which is unreachable from the host).
    const mongoUri = `${container.getConnectionString()}?directConnection=true`
    // Empty legacy dir → migration #1 is no-op (don't import dev data into E2E).
    legacyDir = await mkdtemp(path.join(os.tmpdir(), 'teamable-e2e-legacy-'))
    // Wspólny katalog avatarów backendu i CLI (`user delete` w testach sprząta ten sam katalog).
    dataDir = await mkdtemp(path.join(os.tmpdir(), 'teamable-e2e-data-'))
    // Sekrety generowane na każdy przebieg: CI nie potrzebuje żadnych sekretów repozytorium.
    const env = {
      ...process.env,
      MONGODB_URI: mongoUri,
      LEGACY_PROFILE_DIR: legacyDir,
      PROFILE_DATA_DIR: dataDir,
      BETTER_AUTH_SECRET: randomBytes(32).toString('base64'),
      BETTER_AUTH_URL: 'http://localhost:4173',
      E2E_USER_PASSWORD: process.env.E2E_USER_PASSWORD ?? randomBytes(12).toString('hex'),
    }

    await run('node', ['scripts/migrate.cjs', 'up'], env)
    // Konta A i B dla testów (helpers.ts: USERS); hasło tylko w env tego przebiegu.
    for (const email of ['e2e-a@example.com', 'e2e-b@example.com']) {
      await run(
        'npx',
        ['tsx', 'src/cli/user.ts', 'create', '--email', email, '--password', env.E2E_USER_PASSWORD],
        env,
      )
    }
    // Playwright (frontend) starts backend `start:e2e` (inherits MONGODB_URI) + preview.
    await run('npm', ['--prefix', '../frontend', 'run', 'test:e2e'], env)
  } finally {
    await container.stop()
    if (legacyDir) await rm(legacyDir, { recursive: true, force: true })
    if (dataDir) await rm(dataDir, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
