import { createHttpError } from '../utils/httpError.js'
import { buildNotificationMessage } from '../utils/notificationMessages.js'
import { notificationDefaults } from '../config/notificationPreferences.js'
import { Op } from 'sequelize'
import { Exam, StudyActivity, Subject, Task, NotificationPreference, NotificationPhrase } from '../models/index.js'
import { addDays, calculateDaysRemaining, todayDate } from '../utils/date.js'

const remainingText = (days) => days === 0 ? 'hoy' : `en ${days} ${days === 1 ? 'día' : 'días'}`

export const getNotifications = async (req, res, next) => {
  try {
    const today = todayDate()
    const limit = addDays(today, 7)
    const savedPreferences = await NotificationPreference.findOne({ where: { user_id: req.user.id } })
    const preferences = { ...notificationDefaults, ...(savedPreferences?.get ? savedPreferences.get({ plain: true }) : savedPreferences) }
    const phrases = [preferences.exam_style, preferences.task_style].includes('custom')
      ? await NotificationPhrase.findAll({ where: { user_id: req.user.id } }) : []
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
      where: { user_id: req.user.id },
      attributes: ['name'],
    }]

    const [tasks, exams, activities] = await Promise.all([
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
        attributes: ['title', 'target_date'],
        include: includeSubject(),
        order: [['id', 'ASC']],
      }),
    ])

    const notifications = [
      ...tasks.map((task, index) => ({
        type: 'task',
        message: eventMessage('task', task, index),
        date: task.due_date,
      })),
      ...exams.map((exam, index) => ({
        type: 'exam',
        message: eventMessage('exam', exam, index),
        date: exam.exam_date,
      })),
      ...activities.map((activity) => ({
        type: 'study_activity',
        message: `La actividad ${activity.title} vence ${remainingText(calculateDaysRemaining(activity.target_date, today))}`,
        date: activity.target_date,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date))

    return res.json(notifications.map(({ type, message }, index) => ({
      id: index + 1,
      type,
      message,
      read: false,
    })))
  } catch (error) {
    return next(error)
  }
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
