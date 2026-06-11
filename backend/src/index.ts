import { createApp } from './app.js'
import { connectDb, disconnectDb } from './db/connection.js'

const port = Number(process.env.PORT ?? 3001)

async function main() {
  await connectDb()
  const server = createApp().listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`)
  })

  const shutdown = () => {
    // Force-exit fallback: if connections don't drain (e.g. keep-alive clients
    // hold the socket open), don't hang forever. unref() so this timer alone
    // never keeps the process alive.
    setTimeout(() => process.exit(1), 10_000).unref()
    server.close(() => {
      void disconnectDb().finally(() => process.exit(0))
    })
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  console.error('Failed to start backend:', err)
  process.exit(1)
})
