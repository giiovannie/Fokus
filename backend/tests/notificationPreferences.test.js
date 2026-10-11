import request from 'supertest'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { app } from '../src/app.js'
import { NotificationPreference, NotificationRule, User, sequelize, Exam, Task, Subject } from '../src/models/index.js'
import { notificationDefaults } from '../src/config/notificationPreferences.js'
vi.mock('../src/helpers/token.js', () => ({ verifyToken: token => { if (token !== 'test') throw new Error(); return { sub: 7 } } }))
const auth = req => req.set('Authorization', 'Bearer test')
let prefs, rules, nextId
const transaction = { LOCK: { UPDATE: 'UPDATE' } }
const preferenceRow = data => ({ ...notificationDefaults, user_id: 7, revision: 1, ...data,
  async update(values) { Object.assign(this, values); return this },
  async increment() { this.revision++ },
})
const ruleRow = data => ({ id: nextId++, ...data,
  async update(values) { Object.assign(this, values); return this },
  async destroy() { rules = rules.filter(row => row.id !== this.id) },
})
beforeEach(() => {
  prefs = null; rules = []; nextId = 1
  vi.spyOn(sequelize, 'transaction').mockImplementation(fn => fn(transaction))
  vi.spyOn(User, 'findByPk').mockResolvedValue({ id: 7 })
  vi.spyOn(NotificationPreference, 'findOne').mockImplementation(async () => prefs)
  vi.spyOn(NotificationPreference, 'findOrCreate').mockImplementation(async () => { if (!prefs) prefs = preferenceRow({}); return [prefs] })
  vi.spyOn(NotificationRule, 'findAll').mockImplementation(async ({ where }) => rules.filter(row => row.user_id === where.user_id && (!where.event_type || row.event_type === where.event_type)))
  vi.spyOn(NotificationRule, 'findOne').mockImplementation(async ({ where }) => rules.find(row => row.user_id === where.user_id && row.id === Number(where.id)) || null)
  vi.spyOn(NotificationRule, 'create').mockImplementation(async data => { const row = ruleRow(data); rules.push(row); return row })
})
afterEach(() => vi.restoreAllMocks())
const putPreferences = values => auth(request(app).put('/api/notifications/preferences')).send({ ...notificationDefaults, ...values })
const createRule = (amount = 1, unit = 'days', event_type = 'exam') => auth(request(app).post('/api/notifications/rules')).send({ event_type, amount, unit, enabled: true })

describe('notification preferences and rules', () => {
  it.each(['preferences', 'rules'])('requires JWT for %s', async path => {
    expect((await request(app).get('/api/notifications/' + path)).status).toBe(401)
  })
  it('GET defaults does not write and identifies the authenticated user', async () => {
    const response = await auth(request(app).get('/api/notifications/preferences'))
    expect(response.status).toBe(200); expect(response.body).toEqual({ ...notificationDefaults, revision: 1, unfiltered_consented_at: null })
    expect(NotificationPreference.findOne).toHaveBeenCalledWith({ where: { user_id: 7 } })
    expect(NotificationPreference.findOrCreate).not.toHaveBeenCalled()
  })
  it('saves independent defaults, serializes writes, and is idempotent', async () => {
    expect((await putPreferences({ exam_default_time: '08:30', task_default_time: '10:45' })).body.revision).toBe(2)
    expect(User.findByPk).toHaveBeenCalledWith(7, { transaction, lock: 'UPDATE' })
    expect((await putPreferences({ exam_default_time: '08:30', task_default_time: '10:45' })).body.revision).toBe(2)
  })
  it('requires consent, records it, and permits coherent revocation', async () => {
    expect((await putPreferences({ exam_style: 'unfiltered' })).status).toBe(400)
    const accepted = await putPreferences({ unfiltered_enabled: true, exam_style: 'unfiltered' })
    expect(accepted.status).toBe(200); expect(accepted.body.unfiltered_consented_at).toBeTruthy()
    const revoked = await putPreferences({ unfiltered_enabled: false })
    expect(revoked.body.unfiltered_consented_at).toBeNull()
  })
  it.each([{ timezone: 'Invalid/Zone' }, { timezone: '+03:00' }, { exam_default_time: '24:00' }, { enabled: 'true' }, { user_id: 9 }, { revision: 20 }, { constructor: 'unexpected' }, { unfiltered_consented_at: '2020-01-01' }, { quiet_hours_enabled: true, quiet_start: '22:00', quiet_end: '22:00' }, { quiet_start: '22:00' }])('rejects invalid preferences %j before writes', async values => {
    expect((await putPreferences(values)).status).toBe(400)
    expect(sequelize.transaction).not.toHaveBeenCalled()
  })
  it('accepts silence crossing midnight', async () => {
    expect((await putPreferences({ quiet_hours_enabled: true, quiet_start: '22:00', quiet_end: '07:00' })).status).toBe(200)
  })
  it('converts units and prevents equivalent duplicates', async () => {
    expect((await createRule(1, 'days')).body.offset_minutes).toBe(1440)
    expect((await createRule(24, 'hours')).status).toBe(409)
    expect((await createRule(30, 'minutes')).body.offset_minutes).toBe(30)
    expect((await createRule(30, 'days', 'task')).body.offset_minutes).toBe(43200)
  })
  it('limits five rules per type including disabled rules', async () => {
    for (let i = 0; i < 5; i++) expect((await createRule(i, 'hours')).status).toBe(201)
    rules[0].enabled = false
    expect((await createRule(6, 'hours')).status).toBe(409)
    expect((await createRule(6, 'hours', 'task')).status).toBe(201)
  })
  it.each([[31, 'days'], [43201, 'minutes'], [-1, 'hours'], [1.5, 'days'], ['1', 'hours'], [1, 'weeks']])('rejects invalid offset %s %s', async (amount, unit) => {
    expect((await createRule(amount, unit)).status).toBe(400)
  })
  it('updates and deletes only owned rules and bumps revision', async () => {
    const rule = (await createRule()).body
    rules.push(ruleRow({ user_id: 99, event_type: 'exam', offset_minutes: 0, enabled: true }))
    const update = await auth(request(app).put('/api/notifications/rules/' + rule.id)).send({ event_type: 'exam', amount: 2, unit: 'hours', enabled: false })
    expect(update.body.offset_minutes).toBe(120)
    expect((await auth(request(app).delete('/api/notifications/rules/2'))).status).toBe(404)
    expect((await auth(request(app).get('/api/notifications/rules'))).body).toHaveLength(1)
    expect((await auth(request(app).delete('/api/notifications/rules/' + rule.id))).status).toBe(204)
    expect(prefs.revision).toBe(4)
  })
  it('keeps old records without a time and exposes HH:mm', () => {
    expect(Exam.build({ exam_time: null }).exam_time).toBeNull()
    expect(Task.build({ due_time: '10:15:00' }).due_time).toBe('10:15')
  })
  it.each([['exams', 'exam_time'], ['tasks', 'due_time']])('validates optional %s time before DB', async (path, field) => {
    const result = await auth(request(app).post('/api/' + path)).send({ title: 'Event', subject_id: 1, exam_date: '2026-10-20', due_date: '2026-10-20', [field]: '25:00' })
    expect(result.status).toBe(400)
  })
  it('checks capacity and duplicates when moving a rule to another type', async () => {
    for (let i = 0; i < 5; i++) await createRule(i, 'hours', 'task')
    const exam = (await createRule(6, 'hours')).body
    const move = amount => auth(request(app).put('/api/notifications/rules/' + exam.id)).send({ event_type: 'task', amount, unit: 'hours', enabled: true })
    expect((await move(6)).status).toBe(409)
    expect((await move(1)).status).toBe(409)
    expect(rules.find(row => row.id === exam.id).event_type).toBe('exam')
  })
  it.each([['exams', 'exam_date', 'exam_time', Exam], ['tasks', 'due_date', 'due_time', Task]])('preserves and clears optional time when updating %s', async (path, date, time, Model) => {
    const row = { id: 1, subject_id: 1, title: 'Event', [date]: '2026-10-20', [time]: '10:30', async update(data) { Object.assign(this, data); return this } }
    vi.spyOn(Model, 'findOne').mockResolvedValue(row)
    expect((await auth(request(app).put('/api/' + path + '/1')).send({ title: 'Edited' })).body[time]).toBe('10:30')
    expect((await auth(request(app).put('/api/' + path + '/1')).send({ [time]: null })).body[time]).toBeNull()
    expect((await auth(request(app).put('/api/' + path + '/1')).send({ [time]: '08:45' })).body[time]).toBe('08:45')
    expect((await auth(request(app).put('/api/' + path + '/1')).send({ [time]: ['08:45'] })).status).toBe(400)
    const list = vi.spyOn(Model, 'findAll').mockResolvedValue([])
    expect((await auth(request(app).get('/api/' + path))).status).toBe(200)
    expect(list.mock.calls[0][0].order).toEqual([[date, 'ASC']])
  })
  it.each([['exams', 'exam_date', 'exam_time', Exam], ['tasks', 'due_date', 'due_time', Task]])('accepts events without time and rejects impossible dates in %s', async (path, date, time, Model) => {
    vi.spyOn(Subject, 'findOne').mockResolvedValue({ id: 1, user_id: 7 })
    const create = vi.spyOn(Model, 'create').mockImplementation(async data => ({ id: 1, ...data, [time]: data[time] ?? null }))
    const send = data => auth(request(app).post('/api/' + path)).send({ title: 'Event', subject_id: 1, ...data })
    expect((await send({ [date]: '2026-10-20' })).status).toBe(201)
    expect((await send({ [date]: '2026-02-30' })).status).toBe(400)
    expect((await send({ [date]: '2026-10-20T09:00:00Z' })).status).toBe(400)
    expect((await send({})).status).toBe(400)
    expect(create).toHaveBeenCalledTimes(1)
  })

})
