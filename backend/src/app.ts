import express from 'express'
import { toNodeHandler } from 'better-auth/node'
import { profileRouter } from './routes/profile.js'
import { errorHandler } from './middleware/errorHandler.js'
import { isDbConnected } from './db/connection.js'
import { getAuth } from './auth/auth.js'

export function createApp() {
  const app = express()
  // Przed express.json() - Better Auth sam czyta body. getAuth() per żądanie (leniwa instancja).
  app.all('/api/auth/*splat', (req, res) => toNodeHandler(getAuth())(req, res))
  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    if (isDbConnected()) res.json({ status: 'ok' })
    else res.status(503).json({ status: 'down' })
  })

  app.use('/api/profile', profileRouter)

  // Error-middleware must be registered last.
  app.use(errorHandler)

  return app
}
