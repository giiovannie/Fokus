import { UniqueConstraintError } from 'sequelize'
import { NotificationPreference, NotificationRule, User, sequelize } from '../models/index.js'
import { notificationDefaults, notificationPreferenceFields, maxRulesPerType } from '../config/notificationPreferences.js'
import { pick } from '../utils/pick.js'
import { createHttpError } from '../utils/httpError.js'

const serializePreferences = row => {
  const result = { ...notificationDefaults, ...pick(row || {}, notificationPreferenceFields) }
  for (const key of ['exam_default_time', 'task_default_time', 'quiet_start', 'quiet_end']) {
    if (result[key]) result[key] = result[key].slice(0, 5)
  }
  return { ...result, revision: row?.revision || 1, unfiltered_consented_at: row?.unfiltered_consented_at || null }
}
const serializeRule = row => pick(row, ['id', 'event_type', 'offset_minutes', 'enabled'])
const withUserLock = (userId, action) => sequelize.transaction(async transaction => {
  const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE })
  if (!user) throw createHttpError(401, 'El usuario ya no existe')
  return action(transaction)
})
const bumpRevision = async (userId, transaction) => {
  const [preferences] = await NotificationPreference.findOrCreate({ where: { user_id: userId }, transaction })
  await preferences.increment('revision', { transaction })
}
const handleError = (error, next) => next(error instanceof UniqueConstraintError
  ? createHttpError(409, 'Ya existe un recordatorio con esa anticipación') : error)

export const getNotificationPreferences = async (req, res, next) => {
  try { return res.json(serializePreferences(await NotificationPreference.findOne({ where: { user_id: req.user.id } }))) }
  catch (error) { return next(error) }
}
export const putNotificationPreferences = async (req, res, next) => {
  try {
    const saved = await withUserLock(req.user.id, async transaction => {
      const [row] = await NotificationPreference.findOrCreate({ where: { user_id: req.user.id }, transaction })
      const data = pick(req.body, notificationPreferenceFields)
      const changed = notificationPreferenceFields.some(key => serializePreferences(row)[key] !== data[key])
      if (!changed) return row
      data.unfiltered_consented_at = data.unfiltered_enabled
        ? (row.unfiltered_consented_at || new Date()) : null
      await row.update({ ...data, revision: row.revision + 1 }, { transaction })
      return row
    })
    return res.json(serializePreferences(saved))
  } catch (error) { return next(error) }
}
export const getNotificationRules = async (req, res, next) => {
  try {
    const where = { user_id: req.user.id }
    if (req.query.event_type) where.event_type = req.query.event_type
    return res.json((await NotificationRule.findAll({ where, order: [['event_type', 'ASC'], ['offset_minutes', 'DESC']] })).map(serializeRule))
  } catch (error) { return next(error) }
}
const saveRule = async (req, transaction, updating) => {
  const where = { user_id: req.user.id }
  const row = updating ? await NotificationRule.findOne({ where: { ...where, id: req.params.id }, transaction }) : null
  if (updating && !row) throw createHttpError(404, 'El recordatorio no fue encontrado')
  const data = { event_type: req.body.event_type, enabled: req.body.enabled,
    offset_minutes: req.body.amount * { minutes: 1, hours: 60, days: 1440 }[req.body.unit] }
  const rules = await NotificationRule.findAll({ where: { ...where, event_type: data.event_type }, transaction })
  const others = rules.filter(item => !row || item.id !== row.id)
  if (others.some(item => item.offset_minutes === data.offset_minutes)) throw createHttpError(409, 'Ya existe un recordatorio con esa anticipación')
  if (others.length >= maxRulesPerType) throw createHttpError(409, 'Se permiten hasta cinco recordatorios por tipo')
  if (row && row.event_type === data.event_type && row.enabled === data.enabled && row.offset_minutes === data.offset_minutes) return row
  const saved = row ? await row.update(data, { transaction }) : await NotificationRule.create({ ...data, user_id: req.user.id }, { transaction })
  await bumpRevision(req.user.id, transaction)
  return saved
}
export const createNotificationRule = async (req, res, next) => {
  try { return res.status(201).json(serializeRule(await withUserLock(req.user.id, transaction => saveRule(req, transaction, false)))) }
  catch (error) { return handleError(error, next) }
}
export const updateNotificationRule = async (req, res, next) => {
  try { return res.json(serializeRule(await withUserLock(req.user.id, transaction => saveRule(req, transaction, true)))) }
  catch (error) { return handleError(error, next) }
}
export const deleteNotificationRule = async (req, res, next) => {
  try {
    await withUserLock(req.user.id, async transaction => {
      const row = await NotificationRule.findOne({ where: { id: req.params.id, user_id: req.user.id }, transaction })
      if (!row) throw createHttpError(404, 'El recordatorio no fue encontrado')
      await row.destroy({ transaction }); await bumpRevision(req.user.id, transaction)
    })
    return res.status(204).end()
  } catch (error) { return next(error) }
}
