// Programmatic migrate-mongo runner (CommonJS, no TS/ESM) — isolates migrations from
// the ESM app. Usage: node scripts/migrate.cjs <up|down|status>
// migrate-mongo v14 is ESM-only; use dynamic import() to load it from CJS.

const path = require('node:path')

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set')
  process.exit(1)
}

const cmd = process.argv[2]

async function run() {
  const { config, database, up, down, status } = await import('migrate-mongo')

  config.set({
    mongodb: {
      url: MONGODB_URI,
      databaseName: 'teamable',
      options: {},
    },
    migrationsDir: path.resolve(__dirname, '..', 'migrations'),
    changelogCollectionName: 'changelog',
    lockCollectionName: 'changelog_lock',
    lockTtl: 0,
    migrationFileExtension: '.cjs',
    useFileHash: false,
    moduleSystem: 'commonjs',
  })

  const { db, client } = await database.connect()
  try {
    if (cmd === 'up') {
      const migrated = await up(db, client)
      migrated.forEach((f) => console.log('UP  ', f))
    } else if (cmd === 'down') {
      const reverted = await down(db, client)
      reverted.forEach((f) => console.log('DOWN', f))
    } else if (cmd === 'status') {
      console.table(await status(db))
    } else {
      console.error('usage: node scripts/migrate.cjs <up|down|status>')
      process.exitCode = 1
    }
  } finally {
    await client.close()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
