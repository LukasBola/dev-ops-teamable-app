import express from 'express'
import cors from 'cors'
import { profileRouter } from './routes/profile.js'
import { errorHandler } from './middleware/errorHandler.js'
import { isDbConnected } from './db/connection.js'

export function createApp() {
  const app = express()
  app.use(cors())
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
