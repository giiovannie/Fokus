import request from 'supertest'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { app } from '../src/app.js'
import { User, Exam, Task, StudyActivity, NotificationPreference, NotificationDismissal, NotificationReminder } from '../src/models/index.js'
vi.mock('../src/helpers/token.js', () => ({ verifyToken: token => { if (!['7', '8'].includes(token)) throw new Error(); return { sub: Number(token) } } }))
let rows, events
const call = (method, suffix = '', user = 7) => request(app)[method]('/api/notifications' + suffix).set('Authorization', 'Bearer ' + user)
beforeEach(() => {
  rows = []; events = [{ id: 3, title: 'Parcial', exam_date: '2026-10-13', exam_time: null, subject: { name: 'Historia' } }]
  vi.spyOn(User, 'findByPk').mockImplementation(async id => ({ id }))
  vi.spyOn(NotificationPreference, 'findOne').mockResolvedValue(null)
  vi.spyOn(Exam, 'findAll').mockResolvedValue(events)
  vi.spyOn(Task, 'findAll').mockResolvedValue([])
  vi.spyOn(StudyActivity, 'findAll').mockResolvedValue([])
  vi.spyOn(NotificationDismissal, 'findAll').mockImplementation(async ({ where }) => rows.filter(row => row.user_id === where.user_id))
  vi.spyOn(NotificationDismissal, 'findOne').mockImplementation(async ({ where }) => rows.find(row => row.user_id === where.user_id && row.notification_key === where.notification_key) ?? null)
  vi.spyOn(NotificationDismissal, 'findOrCreate').mockImplementation(async ({ where }) => { const old = rows.find(row => row.user_id === where.user_id && row.notification_key === where.notification_key); if (old) return [old, false]; rows.push(where); return [where, true] })
  vi.spyOn(Exam, 'destroy'); vi.spyOn(NotificationReminder, 'update')
})
afterEach(() => vi.restoreAllMocks())
it('elimina con persistencia, es idempotente y no modifica eventos ni recordatorios', async () => {
  const list = await call('get')
  const key = list.body[0].id
  expect(key).toMatch(/^[a-f0-9]{64}$/)
  expect((await call('delete', '/' + key)).status).toBe(204)
  expect((await call('get')).body).toEqual([])
  expect((await call('delete', '/' + key)).status).toBe(204)
  expect(rows).toHaveLength(1)
  expect(Exam.destroy).not.toHaveBeenCalled()
  expect(NotificationReminder.update).not.toHaveBeenCalled()
})
it('no acepta eliminar notificaciones ajenas ni reintroduce eliminadas por cambios de orden', async () => {
  const key = (await call('get')).body[0].id
  expect((await call('delete', '/' + key, 8)).status).toBe(404)
  expect((await call('delete', '/' + key)).status).toBe(204)
  events.unshift({ ...events[0], id: 4 })
  const result = await call('get')
  expect(result.body).toHaveLength(1)
  expect(result.body[0].id).not.toBe(key)
  expect((await call('get', '', 8)).body).toHaveLength(2)
})
it('rechaza ID inválido y mantiene datos cuando falla la persistencia', async () => {
  expect((await request(app).delete('/api/notifications/' + 'a'.repeat(64))).status).toBe(401)
  expect((await call('delete', '/3')).status).toBe(400)
  NotificationDismissal.findOrCreate.mockRejectedValue(new Error('Persistence failed'))
  const key = (await call('get')).body[0].id
  expect((await call('delete', '/' + key)).status).toBe(500)
  expect((await call('get')).body).toHaveLength(1)
})
