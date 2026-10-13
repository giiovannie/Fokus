import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createUser } from '../src/controllers/user.controller.js'
import { NotificationPreference, NotificationRule, User, sequelize } from '../src/models/index.js'
vi.mock('../src/helpers/password.js', () => ({ hashPassword: async () => 'hash-only-for-tests' }))
const transaction = {}, req = { body: { email: 'STUDENT@example.com', password: 'not-real' } }
let res, next, committed
beforeEach(() => {
  committed = false
  res = { status: vi.fn().mockReturnThis(), json: vi.fn() }; next = vi.fn()
  vi.spyOn(sequelize, 'transaction').mockImplementation(async action => { const value = await action(transaction); committed = true; return value })
  vi.spyOn(User, 'create').mockResolvedValue({ id: 7, email: 'student@example.com' })
  vi.spyOn(NotificationPreference, 'create').mockResolvedValue({})
  vi.spyOn(NotificationRule, 'bulkCreate').mockResolvedValue([])
})
afterEach(() => vi.restoreAllMocks())
describe('recordatorios iniciales de cuentas nuevas', () => {
  it('crea preferencias y reglas útiles en la misma transacción que la cuenta', async () => {
    await createUser(req, res, next)
    expect(User.create).toHaveBeenCalledWith({ email: 'student@example.com', password: 'hash-only-for-tests' }, { transaction })
    expect(NotificationPreference.create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 7, enabled: true, exams_enabled: true, tasks_enabled: true }), { transaction })
    expect(NotificationRule.bulkCreate).toHaveBeenCalledWith([
      { user_id: 7, event_type: 'exam', offset_minutes: 60, enabled: true },
      { user_id: 7, event_type: 'task', offset_minutes: 60, enabled: true },
    ], { transaction })
    expect(committed).toBe(true); expect(res.status).toHaveBeenCalledWith(201)
    expect(next).not.toHaveBeenCalled()
  })
  it.each(['preferences', 'rules'])('no confirma un registro incompleto si fallan %s', async failure => {
    const error = new Error('mock database failure')
    if (failure === 'preferences') NotificationPreference.create.mockRejectedValue(error)
    else NotificationRule.bulkCreate.mockRejectedValue(error)
    await createUser(req, res, next)
    expect(committed).toBe(false); expect(next).toHaveBeenCalledWith(error)
    expect(res.status).not.toHaveBeenCalled()
  })
})
