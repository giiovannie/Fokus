import { createHash } from 'node:crypto'
import { createHttpError } from '../utils/httpError.js'
import { buildNotificationMessage } from '../utils/notificationMessages.js'
import { notificationDefaults } from '../config/notificationPreferences.js'
import { Op } from 'sequelize'
import { AgendaEvent, Exam, StudyActivity, Subject, Task, NotificationPreference, NotificationPhrase, NotificationDismissal } from '../models/index.js'
import { localPlanningDates } from '../services/reminderTime.js'
import { addDays, calculateDaysRemaining, todayDate } from '../utils/date.js'

const remainingText = (days) => days === 0 ? 'hoy' : `en ${days} ${days === 1 ? 'día' : 'días'}`

export const buildInbox = async userId => {
    const today = todayDate()
    const limit = addDays(today, 7)
    const savedPreferences = await NotificationPreference.findOne({ where: { user_id: userId } })
    const preferences = { ...notificationDefaults, ...(savedPreferences?.get ? savedPreferences.get({ plain: true }) : savedPreferences) }
    const phrases = [preferences.exam_style, preferences.task_style].includes('custom')
      ? await NotificationPhrase.findAll({ where: { user_id: userId } }) : []
    const eventMessage = (type, event, index) => {
      let style = preferences[type + '_style']
      if (style === 'unfiltered' && !preferences.unfiltered_enabled) style = 'formal'
      if (style === 'custom' && !phrases.some(phrase => phrase.event_type === type)) style = 'formal'
      const candidates = style === 'custom' ? phrases.filter(phrase => phrase.event_type === type).length : 3
      return buildNotificationMessage({
        eventType: type, style, phrases, unfilteredEnabled: preferences.unfiltered_enabled,
        random: () => (index % candidates) / candidates,
        event: { title: event.title, subject: event.subject.name, date: event[type === 'exam' ? 'exam_date' : 'due_date'],
          time: event[type === 'exam' ? 'exam_time' : 'due_time'] || preferences[type + '_default_time'], timezone: preferences.timezone },
      }).body
    }
    const includeSubject = () => [{
      model: Subject,
      as: 'subject',
      where: { user_id: userId },
      attributes: ['name'],
    }]

    const localToday = localPlanningDates(Date.now(), preferences.timezone)[0]
    const [tasks, exams, activities, agenda] = await Promise.all([
      Task.findAll({
        where: { due_date: { [Op.between]: [today, limit] }, status: { [Op.ne]: 'completed' } },
        attributes: ['id', 'title', 'due_date', 'due_time'],
        include: includeSubject(),
        order: [['id', 'ASC']],
      }),
      Exam.findAll({
        where: { exam_date: { [Op.between]: [today, limit] } },
        attributes: ['id', 'title', 'exam_date', 'exam_time'],
        include: includeSubject(),
        order: [['id', 'ASC']],
      }),
      StudyActivity.findAll({
        where: { target_date: { [Op.between]: [today, limit] }, status: 'pending' },
        attributes: ['id', 'title', 'target_date'],
        include: includeSubject(),
        order: [['id', 'ASC']],
      }),
      AgendaEvent.findAll({ where: { user_id: userId, event_date: { [Op.between]: [localToday, addDays(localToday, 7)] }, event_time: { [Op.ne]: null }, reminder_minutes: { [Op.ne]: null } }, include: [{ model: Subject, as: 'subject', required: false, where: { user_id: userId }, attributes: ['name'] }], order: [['event_date', 'ASC'], ['id', 'ASC']], limit: 500 }),
    ])

    const notifications = [
      ...agenda.map(event => ({ type: 'agenda', source_id: event.id, date: event.event_date, message: buildNotificationMessage({ eventType: 'agenda', event: { title: event.title, subject: event.subject?.name, date: event.event_date, time: event.event_time, timezone: preferences.timezone } }).body })),
      ...tasks.map((task, index) => ({
        type: 'task', source_id: task.id,
        message: eventMessage('task', task, index),
        date: task.due_date,
      })),
      ...exams.map((exam, index) => ({
        type: 'exam', source_id: exam.id,
        message: eventMessage('exam', exam, index),
        date: exam.exam_date,
      })),
      ...activities.map((activity) => ({
        type: 'study_activity', source_id: activity.id,
        message: `La actividad ${activity.title} vence ${remainingText(calculateDaysRemaining(activity.target_date, today))}`,
        date: activity.target_date,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date))

    return notifications.map(({ type, message, date, source_id }) => ({
      id: createHash('sha256').update(JSON.stringify([userId, type, source_id, date])).digest('hex'),
      type, message, date, read: false,
    }))
}

export const getNotifications = async (req, res, next) => {
  try {
    const [notifications, dismissed] = await Promise.all([
      buildInbox(req.user.id), NotificationDismissal.findAll({ where: { user_id: req.user.id }, attributes: ['notification_key'] }),
    ])
    const keys = new Set(dismissed.map(row => row.notification_key))
    return res.json(notifications.filter(item => !keys.has(item.id)))
  } catch (error) { return next(error) }
}

export const dismissNotification = async (req, res, next) => {
  try {
    const key = req.params.id
    if (!/^[a-f0-9]{64}$/.test(key)) throw createHttpError(400, 'La notificación no es válida')
    const where = { user_id: req.user.id, notification_key: key }
    if (await NotificationDismissal.findOne({ where })) return res.status(204).end()
    if (!(await buildInbox(req.user.id)).some(item => item.id === key)) throw createHttpError(404, 'La notificación no fue encontrada')
    await NotificationDismissal.findOrCreate({ where })
    return res.status(204).end()
  } catch (error) { return next(error) }
}

export const dismissAllNotifications = async (req, res, next) => {
  try {
    const notifications = await buildInbox(req.user.id)
    if (notifications.length) await NotificationDismissal.bulkCreate(notifications.map(item => ({ user_id: req.user.id, notification_key: item.id })), { ignoreDuplicates: true })
    return res.status(204).end()
  } catch (error) { return next(error) }
}

// Vista previa autenticada: consultas de lectura, sin entrega ni planificación.
export const createNotificationPreview = async (userId, input) => {
  const { event_type: type, style, unfiltered_consent: consent, previous_phrase: previousText, selected_phrase: selectedText } = input
  const saved = await NotificationPreference.findOne({ where: { user_id: userId } })
  const preferences = { ...notificationDefaults, ...(saved?.get ? saved.get({ plain: true }) : saved) }
  const phrases = style === 'custom' ? await NotificationPhrase.findAll({ where: { user_id: userId, event_type: type } }) : []
  if (style === 'custom' && !phrases.length) throw createHttpError(400, 'Agregá al menos una frase propia para este tipo de evento.')
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: preferences.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]))
  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1)).toISOString().slice(0, 10)
  return buildNotificationMessage({ eventType: type, style, phrases, previousText, selectedText, unfilteredEnabled: consent, test: true,
    event: { title: type === 'exam' ? 'Parcial de práctica' : 'Trabajo de práctica', subject: 'Matemática (ejemplo)', date,
      time: preferences[type + '_default_time'], timezone: preferences.timezone } })
}
export const previewNotification = async (req, res, next) => {
  try { return res.json(await createNotificationPreview(req.user.id, req.body)) }
  catch (error) { return next(error) }
}
