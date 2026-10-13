import { Op } from 'sequelize'
import { AgendaEvent, Subject, Exam, Task, NotificationPreference, NotificationReminder, NotificationDelivery } from '../models/index.js'
import { pick } from '../utils/pick.js'
import { createHttpError } from '../utils/httpError.js'
import { withUserLock } from '../utils/withUserLock.js'
import { ReminderRepository } from '../services/reminderRepository.js'
import { calculateReminders } from '../services/reminderTime.js'
import { notificationDefaults } from '../config/notificationPreferences.js'
import { createHash } from 'node:crypto'
const fields = ['id', 'title', 'description', 'kind', 'event_date', 'event_time', 'subject_id', 'reminder_minutes']
const plain = row => row?.get ? row.get({ plain: true }) : row
const range = req => ({ [Op.between]: [req.query.from, req.query.to] })
const limit = 500
export const getCalendar = async (req, res, next) => {
  try {
    const related = [{ model: Subject, as: 'subject', where: { user_id: req.user.id }, attributes: ['name'] }]
    const [exams, tasks, agenda, preferences] = await Promise.all([
      req.query.custom_only === 'true' ? [] : Exam.findAll({ where: { exam_date: range(req) }, include: related, order: [['exam_date', 'ASC'], ['id', 'ASC']], limit: limit + 1 }),
      req.query.custom_only === 'true' ? [] : Task.findAll({ where: { due_date: range(req) }, include: related, order: [['due_date', 'ASC'], ['id', 'ASC']], limit: limit + 1 }),
      AgendaEvent.findAll({ where: { user_id: req.user.id, event_date: range(req) }, include: [{ model: Subject, as: 'subject', required: false, where: { user_id: req.user.id }, attributes: ['name'] }], order: [['event_date', 'ASC'], ['id', 'ASC']], limit: limit + 1 }),
      NotificationPreference.findOne({ where: { user_id: req.user.id } }),
    ])
    const records = [
      ...exams.slice(0, limit).map(row => ({ key: 'exam:' + row.id, id: row.id, type: 'exam', title: row.title, description: row.topics, date: row.exam_date, time: row.exam_time || null, subject: row.subject?.name, subject_id: row.subject_id, href: '/exams#exam-' + row.id })),
      ...tasks.slice(0, limit).map(row => ({ key: 'task:' + row.id, id: row.id, type: 'task', title: row.title, description: row.description, date: row.due_date, time: row.due_time || null, status: row.status, subject: row.subject?.name, subject_id: row.subject_id, href: '/tasks#task-' + row.id })),
      ...agenda.slice(0, limit).map(row => ({ ...pick(plain(row), fields), key: 'agenda:' + row.id, type: row.kind, date: row.event_date, time: row.event_time || null, subject: row.subject?.name })),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '') || a.key.localeCompare(b.key))
    return res.json({ events: records, timezone: preferences?.timezone || notificationDefaults.timezone, truncated: [exams, tasks, agenda].some(rows => rows.length > limit) })
  } catch (error) { return next(error) }
}
const mutate = async (req, action) => {
  const result = await new ReminderRepository().withRunLock(async assertOwned => withUserLock(req.user.id, async transaction => {
    await assertOwned()
    let event
    if (req.params.id) {
      event = await AgendaEvent.findOne({ where: { id: req.params.id, user_id: req.user.id }, transaction, lock: transaction.LOCK.UPDATE })
      if (!event) throw createHttpError(404, 'La actividad no fue encontrada.')
    }
    if (action !== 'delete') {
      if (req.body.subject_id && !await Subject.findOne({ where: { id: req.body.subject_id, user_id: req.user.id }, transaction })) throw createHttpError(400, 'La materia no pertenece a tu cuenta.')
      const values = pick(req.body, fields.filter(key => key !== 'id'))
      event = event ? await event.update(values, { transaction }) : await AgendaEvent.create({ ...values, user_id: req.user.id }, { transaction })
    }
    const pending = await NotificationReminder.findAll({ where: { user_id: req.user.id, event_type: 'agenda', event_id: event.id, status: 'pending' }, transaction })
    for (const reminder of pending) {
      await reminder.update({ status: 'cancelled', cancellation_reason: action === 'delete' ? 'event_deleted' : 'event_changed' }, { transaction })
      await NotificationDelivery.update({ status: 'cancelled', last_error_code: action === 'delete' ? 'event_deleted' : 'event_changed' }, { where: { reminder_id: reminder.id, status: 'pending' }, transaction })
    }
    if (action === 'delete') { await event.destroy({ transaction }); await assertOwned(); return null }
    const [preferences] = await NotificationPreference.findOrCreate({ where: { user_id: req.user.id }, transaction })
    const plans = calculateReminders({ event: plain(event), eventType: 'agenda', preferences: plain(preferences), rules: [] })
    for (const plan of plans.filter(item => item.due_at.getTime() > Date.now())) {
      const values = { due_at: plan.due_at, event_at: plan.event_at, source_hash: createHash('sha256').update(JSON.stringify([plain(event), plain(preferences)])).digest('hex') }
      const [reminder] = await NotificationReminder.findOrCreate({ where: { user_id: req.user.id, event_type: 'agenda', event_id: event.id, offset_minutes: plan.offset_minutes }, defaults: values, transaction })
      if (['pending', 'cancelled'].includes(reminder.status)) await reminder.update({ ...values, status: 'pending', cancellation_reason: null }, { transaction })
    }
    await assertOwned()
    return pick(plain(event), fields)
  }))
  if (result?.skipped) throw createHttpError(503, 'Hay recordatorios en curso. Tus datos no se guardaron; reintentá en unos segundos.')
  return result
}
export const createAgendaEvent = async (req, res, next) => { try { return res.status(201).json(await mutate(req, 'create')) } catch (error) { return next(error) } }
export const updateAgendaEvent = async (req, res, next) => { try { return res.json(await mutate(req, 'update')) } catch (error) { return next(error) } }
export const deleteAgendaEvent = async (req, res, next) => { try { await mutate(req, 'delete'); return res.status(204).end() } catch (error) { return next(error) } }
