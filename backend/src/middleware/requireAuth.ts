import type { RequestHandler } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { getAuth } from '../auth/auth.js'

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const session = await getAuth().api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (!session) {
      res.status(401).json({ error: 'Wymagane logowanie' })
      return
    }
    req.currentUser = { id: session.user.id, email: session.user.email }
    next()
  } catch (err) {
    next(err)
  }
}
