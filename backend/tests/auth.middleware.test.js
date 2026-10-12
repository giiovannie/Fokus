import { User } from '../src/models/User.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticate } from '../src/middlewares/auth.middleware.js'
import { generateToken } from '../src/helpers/token.js'

describe('middleware de autenticación', () => {
  beforeEach(() => { process.env.JWT_SECRET = 'test-secret-only'; vi.spyOn(User, 'findByPk').mockResolvedValue({ id: 7, role: 'student' }) })
  afterEach(() => { delete process.env.JWT_SECRET; vi.restoreAllMocks() })

  it('rechaza peticiones sin Bearer token', () => {
    const req = { get: vi.fn(() => undefined) }
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('expone el usuario de un token válido', async () => {
    const token = generateToken(7)
    const req = { get: vi.fn(() => `Bearer ${token}`) }
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()

    await authenticate(req, res, next)

    expect(req.user).toEqual({ id: 7, role: 'student' })
    expect(next).toHaveBeenCalledOnce()
  })
})
