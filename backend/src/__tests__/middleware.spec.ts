import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextFunction, Request, Response } from 'express'

const getSession = vi.fn()
vi.mock('../auth/auth.js', () => ({ getAuth: () => ({ api: { getSession } }) }))

const { requireAuth } = await import('../middleware/requireAuth.js')
const { originCheck } = await import('../middleware/originCheck.js')

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() }
  res.status.mockReturnValue(res)
  return res
}

const req = (init: { method?: string; origin?: string } = {}) =>
  ({
    method: init.method ?? 'GET',
    headers: init.origin ? { origin: init.origin } : {},
  }) as unknown as Request

beforeEach(() => {
  getSession.mockReset()
})

describe('requireAuth', () => {
  it('bez sesji → 401 { error: "Wymagane logowanie" }, next niewołane (FR-15)', async () => {
    getSession.mockResolvedValue(null)
    const res = mockRes()
    const next = vi.fn()
    await requireAuth(req(), res as unknown as Response, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Wymagane logowanie' })
    expect(next).not.toHaveBeenCalled()
  })

  it('z sesją → next() bez argumentu i req.currentUser = { id, email }', async () => {
    getSession.mockResolvedValue({
      session: { id: 's1', userId: 'u1' },
      user: { id: 'u1', email: 'anna@example.com', name: 'Anna' },
    })
    const r = req()
    const next = vi.fn()
    await requireAuth(r, mockRes() as unknown as Response, next)
    expect(next).toHaveBeenCalledWith()
    expect(r.currentUser).toEqual({ id: 'u1', email: 'anna@example.com' })
  })

  it('getSession rzuca → next(err)', async () => {
    const err = new Error('baza padła')
    getSession.mockRejectedValue(err)
    const next = vi.fn()
    await requireAuth(req(), mockRes() as unknown as Response, next)
    expect(next).toHaveBeenCalledWith(err)
  })
})

describe('originCheck (BETTER_AUTH_URL = http://localhost:4173)', () => {
  function run(method: string, origin?: string) {
    const res = mockRes()
    const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>
    originCheck(req({ method, origin }), res as unknown as Response, next)
    return { res, next }
  }

  it.each(['PUT', 'POST', 'PATCH', 'DELETE'])('%s z obcym Origin → 403', (method) => {
    const { res, next } = run(method, 'https://evil.example')
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Niedozwolony origin' })
    expect(next).not.toHaveBeenCalled()
  })

  it('PUT z własnym Origin → next()', () => {
    expect(run('PUT', 'http://localhost:4173').next).toHaveBeenCalledWith()
  })

  it('PUT bez Origin (np. curl) → next()', () => {
    expect(run('PUT').next).toHaveBeenCalledWith()
  })

  it.each(['GET', 'HEAD', 'OPTIONS'])(
    '%s z obcym Origin → next() (metoda bezpieczna)',
    (method) => {
      expect(run(method, 'https://evil.example').next).toHaveBeenCalledWith()
    },
  )
})
