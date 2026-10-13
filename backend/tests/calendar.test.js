import request from 'supertest'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { Op } from 'sequelize'
import { app } from '../src/app.js'
import { AgendaEvent, User, Exam, Task, Subject, NotificationPreference, NotificationReminder, NotificationDelivery, sequelize } from '../src/models/index.js'
import { ReminderRepository } from '../src/services/reminderRepository.js'
vi.mock('../src/helpers/token.js', () => ({ verifyToken: token => ({ sub: Number(token) }) }))
const tx = { LOCK: { UPDATE: 'UPDATE' } }
const body = () => ({ title: 'Consulta', description: '', kind: 'academic', event_date: '2026-10-13', event_time: '18:00', subject_id: 2, reminder_minutes: 60 })
const call = (method, path = '', id = 7) => request(app)[method]('/api/calendar' + path).set('Authorization', 'Bearer ' + id)
let events, reminders, owned
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime('2026-10-13T12:00:00Z')
  events = []; reminders = []; owned = vi.fn().mockResolvedValue(undefined)
  const row = values => ({ ...values, update: vi.fn(async function (input) { Object.assign(this, input); return this }), destroy: vi.fn(async function () { events = events.filter(item => item.id !== this.id) }) })
  vi.spyOn(User, 'findByPk').mockImplementation(async id => ({ id: Number(id), role: Number(id) === 8 ? 'superadmin' : 'student', status: 'active' }))
  vi.spyOn(sequelize, 'transaction').mockImplementation(async action => action(tx))
  vi.spyOn(ReminderRepository.prototype, 'withRunLock').mockImplementation(async action => action(owned))
  vi.spyOn(AgendaEvent, 'create').mockImplementation(async values => { const event = row({ ...values, id: events.length + 1 }); events.push(event); return event })
  vi.spyOn(AgendaEvent, 'findOne').mockImplementation(async ({ where }) => events.find(event => event.id === Number(where.id) && event.user_id === where.user_id) || null)
  vi.spyOn(AgendaEvent, 'findAll').mockImplementation(async ({ where }) => events.filter(event => event.user_id === where.user_id))
  vi.spyOn(Exam, 'findAll').mockResolvedValue([]); vi.spyOn(Task, 'findAll').mockResolvedValue([])
  vi.spyOn(Subject, 'findOne').mockImplementation(async ({ where }) => where.id === 2 && where.user_id === 7 ? { id: 2 } : null)
  const preferences = { enabled: true, timezone: 'America/Argentina/Cordoba', quiet_hours_enabled: false, exams_enabled: false, tasks_enabled: false }
  vi.spyOn(NotificationPreference, 'findOne').mockResolvedValue(preferences)
  vi.spyOn(NotificationPreference, 'findOrCreate').mockResolvedValue([preferences, false])
  vi.spyOn(NotificationReminder, 'findAll').mockImplementation(async ({ where }) => reminders.filter(item => item.event_id === where.event_id && item.user_id === where.user_id && item.status === where.status))
  vi.spyOn(NotificationReminder, 'findOrCreate').mockImplementation(async ({ where, defaults }) => { let reminder = reminders.find(item => item.event_id === where.event_id && item.offset_minutes === where.offset_minutes); if (reminder) return [reminder, false]; reminder = row({ ...where, ...defaults, id: reminders.length + 1, status: 'pending' }); reminders.push(reminder); return [reminder, true] })
  vi.spyOn(NotificationDelivery, 'update').mockResolvedValue([1])
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
it('lee un rango acotado con joins propios y conserva las fechas civiles coincidentes', async () => {
  Exam.findAll.mockResolvedValue([{ id: 1, title: 'Parcial', exam_date: '2026-10-13', exam_time: '00:15', subject_id: 2, subject: { name: 'Historia' } }])
  Task.findAll.mockResolvedValue([{ id: 1, title: 'Entrega', due_date: '2026-10-13', due_time: null }])
  await call('post', '/events').send(body())
  const result = await call('get', '?from=2026-10-01&to=2026-11-01')
  expect(result.status).toBe(200); expect(result.body.events.map(item => item.key).sort()).toEqual(['agenda:1', 'exam:1', 'task:1'])
  expect(result.body.events.every(item => item.date === '2026-10-13')).toBe(true)
  for (const model of [Exam, Task]) expect(model.findAll.mock.calls[0][0].include[0].where).toEqual({ user_id: 7 })
  expect(Task.findAll.mock.calls[0][0].where.due_date[Op.between]).toEqual(['2026-10-01', '2026-11-01'])
  expect(AgendaEvent.findAll.mock.calls[0][0]).toMatchObject({ where: { user_id: 7 }, limit: 501, include: [{ required: false, where: { user_id: 7 } }] })
})
it.each(['?from=2026-02-30&to=2026-03-01', '?from=2026-10-13&to=2026-10-12', '?from=2026-01-01&to=2026-12-31', '?from=2026-10-13&to=2026-10-14&custom_only=unsafe'])('rechaza rango inválido %s antes de consultar eventos', async query => {
  expect((await call('get', query)).status).toBe(400); expect(AgendaEvent.findAll).not.toHaveBeenCalled()
})
it('el Dashboard consulta solo la agenda y el límite se comunica al cliente', async () => {
  AgendaEvent.findAll.mockResolvedValue(Array.from({ length: 501 }, (_, id) => ({ id, title: 'Actividad', kind: 'personal', event_date: '2026-10-13' })))
  const result = await call('get', '?from=2026-10-13&to=2026-10-14&custom_only=true')
  expect(result.body.events).toHaveLength(500); expect(result.body.truncated).toBe(true)
  expect(Exam.findAll).not.toHaveBeenCalled(); expect(Task.findAll).not.toHaveBeenCalled()
})
it('crea y consulta una actividad sin hora sin inventar recordatorios', async () => {
  const result = await call('post', '/events').send({ ...body(), kind: 'personal', subject_id: null, event_time: null, reminder_minutes: null })
  expect(result.status).toBe(201); expect(result.body.event_time).toBeNull(); expect(result.body).not.toHaveProperty('user_id')
  expect(events[0].user_id).toBe(7); expect(reminders).toHaveLength(0)
  expect(owned).toHaveBeenCalledTimes(2)
})
it('planifica el aviso futuro en Argentina aun con reglas de examen/tarea desactivadas', async () => {
  expect((await call('post', '/events').send(body())).status).toBe(201)
  expect(reminders[0]).toMatchObject({ event_type: 'agenda', user_id: 7, offset_minutes: 60, status: 'pending' })
  expect(reminders[0].due_at.toISOString()).toBe('2026-10-13T20:00:00.000Z')
  expect(reminders[0].event_at.toISOString()).toBe('2026-10-13T21:00:00.000Z')
})
it('edita conservando la identidad, cancela el intento pendiente y reprograma', async () => {
  await call('post', '/events').send(body())
  const result = await call('put', '/events/1').send({ ...body(), event_time: '19:00' })
  expect(result.status).toBe(200); expect(reminders).toHaveLength(1)
  expect(reminders[0].due_at.toISOString()).toBe('2026-10-13T21:00:00.000Z')
  expect(NotificationDelivery.update).toHaveBeenCalledWith({ status: 'cancelled', last_error_code: 'event_changed' }, { where: { reminder_id: 1, status: 'pending' }, transaction: tx })
})
it('elimina únicamente la actividad propia y cancela sus pendientes', async () => {
  await call('post', '/events').send(body())
  expect((await call('delete', '/events/1')).status).toBe(204)
  expect(events).toHaveLength(0); expect(reminders[0].status).toBe('cancelled'); expect(reminders[0].cancellation_reason).toBe('event_deleted')
  expect(NotificationDelivery.update).toHaveBeenCalledWith({ status: 'cancelled', last_error_code: 'event_deleted' }, { where: { reminder_id: 1, status: 'pending' }, transaction: tx })
})
it('no vuelve a abrir una identidad ya entregada al editar', async () => {
  await call('post', '/events').send(body()); reminders[0].status = 'processed'
  await call('put', '/events/1').send({ ...body(), title: 'Título actualizado' })
  expect(reminders).toHaveLength(1); expect(reminders[0].status).toBe('processed')
})
it('no programa avisos retroactivos ni con preferencias desactivadas', async () => {
  await call('post', '/events').send({ ...body(), event_time: '09:30' })
  expect(reminders).toHaveLength(0)
  NotificationPreference.findOrCreate.mockResolvedValue([{ enabled: false }, false])
  await call('post', '/events').send(body()); expect(reminders).toHaveLength(0)
})
it.each([{ event_time: null }, { reminder_minutes: 7 }, { event_date: '2026-02-30' }, { event_date: '0001-01-01' }, { event_time: '25:00' }, { title: ' ' }, { user_id: 99 }, { kind: 'personal' }])('rechaza campos inválidos o propiedad inyectada %j', async overrides => {
  expect((await call('post', '/events').send({ ...body(), ...overrides })).status).toBe(400)
  expect(AgendaEvent.create).not.toHaveBeenCalled()
})
it('deniega acceso anónimo, administración, materias ajenas y eventos ajenos', async () => {
  expect((await request(app).get('/api/calendar?from=2026-10-13&to=2026-10-14')).status).toBe(401)
  expect((await call('get', '?from=2026-10-13&to=2026-10-14', 8)).status).toBe(403)
  expect((await call('post', '/events').send({ ...body(), subject_id: 99 })).status).toBe(400)
  await call('post', '/events').send(body())
  expect((await call('delete', '/events/1', 9)).status).toBe(404)
  expect((await call('put', '/events/1', 9).send(body())).status).toBe(404)
  expect(events).toHaveLength(1)
  expect((await call('get', '?from=2026-10-13&to=2026-10-14', 9)).body.events).toEqual([])
})
it('preserva el formulario en caso de worker ocupado sin escribir datos', async () => {
  ReminderRepository.prototype.withRunLock.mockResolvedValue({ skipped: 'busy' })
  expect((await call('post', '/events').send(body())).status).toBe(503)
  expect(AgendaEvent.create).not.toHaveBeenCalled()
})
it('el repositorio real no crea avisos de agenda cuyo vencimiento ya pasó', async () => {
  const repository = new ReminderRepository()
  const event = { ...body(), id: 2 }
  const plan = { offset_minutes: 0, due_at: new Date(Date.now() - 1), event_at: new Date(Date.now() + 60000) }
  await repository.planEvent(7, 'agenda', event, [plan], 'test-hash')
  expect(NotificationReminder.findOrCreate).not.toHaveBeenCalled()
})
