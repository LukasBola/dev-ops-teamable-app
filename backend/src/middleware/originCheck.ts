import type { RequestHandler } from 'express'
import { env } from '../env.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// CSRF: przeglądarka zawsze wysyła Origin przy żądaniach zmieniających stan z innej strony.
// Brak Origin = klient spoza przeglądarki (curl), który i tak nie ma ciasteczek ofiary.
export const originCheck: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin
  if (SAFE_METHODS.has(req.method) || !origin || origin === new URL(env().BETTER_AUTH_URL).origin) {
    next()
    return
  }
  res.status(403).json({ error: 'Niedozwolony origin' })
}
