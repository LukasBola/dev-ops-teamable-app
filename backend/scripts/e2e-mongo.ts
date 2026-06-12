import os from 'node:os'
import path from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
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
  try {
    // Append directConnection=true so Mongoose bypasses replica-set topology
    // discovery (testcontainers/mongodb enables RS mode; the RS member advertises
    // its internal Docker hostname, which is unreachable from the host).
    const mongoUri = `${container.getConnectionString()}?directConnection=true`
    // Empty legacy dir → migration #1 is no-op (don't import dev data into E2E).
    legacyDir = await mkdtemp(path.join(os.tmpdir(), 'teamable-e2e-legacy-'))
    const env = {
      ...process.env,
      MONGODB_URI: mongoUri,
      LEGACY_PROFILE_DIR: legacyDir,
    }

    await run('node', ['scripts/migrate.cjs', 'up'], env)
    // Playwright (frontend) starts backend `start:e2e` (inherits MONGODB_URI) + preview.
    await run('npm', ['--prefix', '../frontend', 'run', 'test:e2e'], env)
  } finally {
    await container.stop()
    if (legacyDir) await rm(legacyDir, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
