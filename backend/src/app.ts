import express from 'express'
import cors from 'cors'
import { profileRouter } from './routes/profile.js'
import { errorHandler } from './middleware/errorHandler.js'

export function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api/profile', profileRouter)

  // Error-middleware must be registered last.
  app.use(errorHandler)

  return app
}
