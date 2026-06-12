import { connectDb, disconnectDb } from '../src/db/connection.js'
import { seedDemoProfile } from '../src/services/seedProfile.js'

async function main() {
  await connectDb()
  await seedDemoProfile()
  console.log('Seeded demo profile.')
  await disconnectDb()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
