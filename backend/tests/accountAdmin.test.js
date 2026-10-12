import { accountDeletionLimiter } from '../src/middlewares/rateLimit.middleware.js'
import request from 'supertest'
import { Op } from 'sequelize'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { app } from '../src/app.js'
import { User, Profile, Teacher, Subject, Task, Exam, NotificationReminder, NotificationDelivery, NotificationWorkerState, sequelize } from '../src/models/index.js'
import { comparePassword } from '../src/helpers/password.js'
import { deleteAccountAvatars, getOwnedAvatarId } from '../src/services/cloudinary.service.js'
import { ReminderRepository } from '../src/services/reminderRepository.js'
import { assignSuperadmin, approvedAdminEmail } from '../src/services/superadminAssignment.js'
vi.mock('../src/helpers/token.js', () => ({ verifyToken: token => { if (!['7', '8'].includes(token)) throw new Error(); return { sub: Number(token), role: 'superadmin' } }, generateToken: () => 'test-only' }))
vi.mock('../src/helpers/password.js', () => ({ comparePassword: vi.fn(), hashPassword: async () => 'test-hash' }))
vi.mock('../src/services/cloudinary.service.js', () => ({ deleteAccountAvatars: vi.fn(), getOwnedAvatarId: vi.fn() }))
const tx = { LOCK: { UPDATE: 'UPDATE' } }
let accounts, profile, owned, transaction
const auth = (req, id = 7) => req.set('Authorization', 'Bearer ' + id)
const remove = values => auth(request(app).delete('/api/users/me')).send({ password: 'current-password', confirmation: 'ELIMINAR', ...values })
beforeEach(() => {
  accountDeletionLimiter.resetKey('7')
  owned = vi.fn().mockResolvedValue(undefined)
  const row = id => ({ id, email: id === 8 ? approvedAdminEmail : 'student@example.test', role: id === 8 ? 'superadmin' : 'student', password: 'test-hash',
    destroy: vi.fn(async () => accounts.delete(id)), update: vi.fn(async function (values) { Object.assign(this, values) }) })
  accounts = new Map([[7, row(7)], [8, row(8)]])
  vi.spyOn(User, 'findByPk').mockImplementation(async id => accounts.get(Number(id)) ?? null)
  transaction = vi.spyOn(sequelize, 'transaction').mockImplementation(async action => action(tx))
  vi.spyOn(ReminderRepository.prototype, 'withRunLock').mockImplementation(async action => action(owned))
  profile = { id: 3, user_id: 7, avatar_url: 'owned-photo' }
  vi.spyOn(Profile, 'findOne').mockImplementation(async ({ where }) => where.user_id === 7 ? profile : null)
  vi.spyOn(Teacher, 'findAll').mockResolvedValue([{ id: 4 }])
  vi.spyOn(Subject, 'count').mockResolvedValue(0)
  vi.spyOn(NotificationDelivery, 'count').mockResolvedValue(0)
  for (const model of [Subject, Teacher, NotificationWorkerState]) vi.spyOn(model, 'destroy').mockResolvedValue(1)
  vi.spyOn(NotificationReminder, 'update').mockResolvedValue([1])
  comparePassword.mockImplementation(async password => password === 'current-password')
  getOwnedAvatarId.mockReturnValue('fokus/avatars/7/3/test-only')
  deleteAccountAvatars.mockResolvedValue(undefined)
})
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks() })

describe('eliminación de la cuenta propia', () => {
  it('requiere JWT y confirmación exacta sin aceptar usuarios ajenos en el cuerpo', async () => {
    expect((await request(app).delete('/api/users/me').send({})).status).toBe(401)
    expect((await remove({ confirmation: 'eliminar' })).status).toBe(400)
    expect((await remove({ user_id: 8 })).status).toBe(400)
    expect(Subject.destroy).not.toHaveBeenCalled()
    expect(deleteAccountAvatars).not.toHaveBeenCalled()
  })
  it('rechaza una contraseña incorrecta sin borrar datos ni foto', async () => {
    expect((await remove({ password: 'wrong-password' })).status).toBe(403)
    expect(accounts.size).toBe(2)
    expect(Subject.destroy).not.toHaveBeenCalled()
    expect(deleteAccountAvatars).not.toHaveBeenCalled()
  })
  it('borra solo datos propios, cancela pendientes y revoca todos sus JWT', async () => {
    const other = accounts.get(8)
    expect((await remove()).status).toBe(204)
    expect(accounts.has(7)).toBe(false); expect(accounts.get(8)).toBe(other)
    expect(Subject.destroy).toHaveBeenCalledWith({ where: { user_id: 7 }, transaction: tx })
    expect(Teacher.destroy).toHaveBeenCalledWith({ where: { user_id: 7 }, transaction: tx })
    expect(NotificationReminder.update).toHaveBeenCalledWith({ status: 'cancelled', cancellation_reason: 'account_deleted' }, { where: { user_id: 7, status: 'pending' }, transaction: tx })
    expect(NotificationWorkerState.destroy).toHaveBeenCalledWith({ where: { scope: ['events:7:exam', 'events:7:task'] }, transaction: tx })
    expect(deleteAccountAvatars).toHaveBeenCalledWith(7, { required: true })
    expect(other.destroy).not.toHaveBeenCalled()
    expect((await auth(request(app).get('/api/tasks'))).status).toBe(401)
  })
  it('espera cuando un procesador está activo y no toca datos', async () => {
    ReminderRepository.prototype.withRunLock.mockResolvedValue({ skipped: 'busy' })
    expect((await remove()).status).toBe(409)
    expect(transaction).not.toHaveBeenCalled()
    expect(deleteAccountAvatars).not.toHaveBeenCalled()
  })
  it.each(['avatar desconocido', 'Cloudinary', 'relación cruzada', 'entrega cruzada'])('no confirma la baja ante %s', async reason => {
    if (reason === 'avatar desconocido') getOwnedAvatarId.mockReturnValue(null)
    if (reason === 'Cloudinary') deleteAccountAvatars.mockRejectedValue(Object.assign(new Error('Cleanup unavailable'), { status: 503 }))
    if (reason === 'relación cruzada') Subject.count.mockResolvedValue(1)
    if (reason === 'entrega cruzada') NotificationDelivery.count.mockResolvedValue(1)
    expect((await remove()).status).toBe(reason === 'Cloudinary' ? 503 : 409)
    expect(accounts.size).toBe(2)
    expect(Subject.destroy).not.toHaveBeenCalled()
  })
  it('detiene antes de borrar cuando pierde el bloqueo del worker', async () => {
    owned.mockRejectedValue(new Error('Lost lock'))
    expect((await remove()).status).toBe(500)
    expect(deleteAccountAvatars).not.toHaveBeenCalled()
    expect(Subject.destroy).not.toHaveBeenCalled()
  })
  it('no confirma si falla la transacción y permite reintentar una foto ya retirada', async () => {
    Subject.destroy.mockRejectedValueOnce(new Error('Database failure'))
    expect((await remove()).status).toBe(500)
    expect(accounts.has(7)).toBe(true)
    expect((await remove()).status).toBe(204)
  })
})

describe('superadministración', () => {
  it('rechaza usuarios comunes aunque el JWT o el registro declaren superadmin', async () => {
    const count = vi.spyOn(User, 'count').mockResolvedValue(2)
    expect((await auth(request(app).get('/api/admin/statistics')).set('X-Role', 'superadmin')).status).toBe(403)
    expect(count).not.toHaveBeenCalled()
    vi.spyOn(User, 'create').mockResolvedValue({ id: 9, email: approvedAdminEmail })
    expect((await request(app).post('/api/users').send({ email: approvedAdminEmail, password: 'password-for-test', role: 'superadmin' })).status).toBe(201)
    expect(User.create.mock.calls[0][0]).not.toHaveProperty('role')
    expect(User.rawAttributes.role.defaultValue).toBe('student')
  })
  it('devuelve solo agregados y fechas UTC con definición verificable de actividad', async () => {
    vi.spyOn(User, 'count').mockResolvedValue(9)
    Subject.count.mockResolvedValue(12)
    vi.spyOn(Task, 'count').mockResolvedValue(20)
    vi.spyOn(Exam, 'count').mockResolvedValue(7)
    vi.spyOn(User, 'findAll').mockResolvedValue([])
    vi.spyOn(sequelize, 'query').mockResolvedValue([{ count: 3 }])
    const res = await auth(request(app).get('/api/admin/statistics'), 8)
    expect(res.status).toBe(200)
    expect(res.body.totals).toEqual({ users: 9, subjects: 12, tasks: 20, exams: 7 })
    expect(res.body.registration_history).toHaveLength(30)
    expect(res.body.active_users_last_7_days).toBe(3)
    expect(res.body.activity_definition).toContain('No mide visitas')
    expect(res.headers['cache-control']).toBe('no-store')
    expect(JSON.stringify(res.body)).not.toMatch(/password|test-hash|student@example|subscription/)
    expect(sequelize.query.mock.calls[0][0]).toContain('COUNT(DISTINCT')
    expect(User.count).toHaveBeenCalledWith({ where: { createdAt: { [Op.gte]: expect.any(Date) } } })
  })
  it('requiere confirmación, correo existente aprobado y contraseña para asignar rol', async () => {
    await expect(assignSuperadmin({ userId: 8, password: 'current-password', confirmed: false, identityVerified: true })).rejects.toMatchObject({ status: 400 })
    await expect(assignSuperadmin({ userId: 8, password: 'current-password', confirmed: true, identityVerified: false })).rejects.toMatchObject({ status: 400 })
    await expect(assignSuperadmin({ userId: 7, password: 'current-password', confirmed: true, identityVerified: true })).rejects.toMatchObject({ status: 403 })
    await expect(assignSuperadmin({ userId: 8, password: 'wrong-password', confirmed: true, identityVerified: true })).rejects.toMatchObject({ status: 403 })
    accounts.get(8).role = 'student'
    await assignSuperadmin({ userId: 8, password: 'current-password', confirmed: true, identityVerified: true })
    expect(accounts.get(8).update).toHaveBeenCalledWith({ role: 'superadmin' }, { transaction: tx })
  })
})
