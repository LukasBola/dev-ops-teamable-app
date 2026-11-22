import { connectDb, disconnectDb } from '../src/db/connection.js'
import { seedDemoUser } from '../src/services/seedProfile.js'

async function main() {
  await connectDb()
  await seedDemoUser()
  console.log(`Konto demo gotowe: ${process.env.DEMO_USER_EMAIL}`)
  await disconnectDb()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
