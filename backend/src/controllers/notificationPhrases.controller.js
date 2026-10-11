import { UniqueConstraintError } from 'sequelize'
import { NotificationPhrase, NotificationPreference } from '../models/index.js'
import { withUserLock, bumpRevision } from './notificationPreferences.controller.js'
import { createHttpError } from '../utils/httpError.js'
import { pick } from '../utils/pick.js'
const serialize = row => pick(row, ['id', 'event_type', 'content'])
const handleError = (error, next) => next(error instanceof UniqueConstraintError
  ? createHttpError(409, 'Ya tenés esa frase para ese tipo de evento') : error)
export const getNotificationPhrases = async (req, res, next) => {
  try {
    const where = { user_id: req.user.id }
    if (req.query.event_type) where.event_type = req.query.event_type
    return res.json((await NotificationPhrase.findAll({ where, order: [['id', 'ASC']] })).map(serialize))
  } catch (error) { return next(error) }
}
const protectSelectedStyle = async (userId, row, phrases, transaction) => {
  if (phrases.some(item => item.id !== row.id && item.event_type === row.event_type)) return
  const preferences = await NotificationPreference.findOne({ where: { user_id: userId }, transaction })
  if (preferences?.[row.event_type + '_style'] === 'custom') throw createHttpError(409, 'Elegí otro estilo antes de quitar la última frase de ese tipo')
}
const savePhrase = async (req, transaction, updating) => {
  const where = { user_id: req.user.id }
  const row = updating ? await NotificationPhrase.findOne({ where: { ...where, id: req.params.id }, transaction }) : null
  if (updating && !row) throw createHttpError(404, 'La frase no fue encontrada')
  const data = pick(req.body, ['event_type', 'content'])
  const phrases = await NotificationPhrase.findAll({ where, transaction })
  if (!updating && phrases.length >= 10) throw createHttpError(409, 'Podés guardar hasta 10 frases en total entre exámenes y entregas')
  if (phrases.some(item => item.id !== row?.id && item.event_type === data.event_type && item.content === data.content)) throw createHttpError(409, 'Ya tenés esa frase para ese tipo de evento')
  if (row && row.event_type !== data.event_type) await protectSelectedStyle(req.user.id, row, phrases, transaction)
  if (row && row.event_type === data.event_type && row.content === data.content) return row
  const saved = row ? await row.update(data, { transaction }) : await NotificationPhrase.create({ ...data, user_id: req.user.id }, { transaction })
  await bumpRevision(req.user.id, transaction)
  return saved
}
export const createNotificationPhrase = async (req, res, next) => {
  try { return res.status(201).json(serialize(await withUserLock(req.user.id, tx => savePhrase(req, tx, false)))) }
  catch (error) { return handleError(error, next) }
}
export const updateNotificationPhrase = async (req, res, next) => {
  try { return res.json(serialize(await withUserLock(req.user.id, tx => savePhrase(req, tx, true)))) }
  catch (error) { return handleError(error, next) }
}
export const deleteNotificationPhrase = async (req, res, next) => {
  try {
    await withUserLock(req.user.id, async transaction => {
      const row = await NotificationPhrase.findOne({ where: { id: req.params.id, user_id: req.user.id }, transaction })
      if (!row) throw createHttpError(404, 'La frase no fue encontrada')
      const phrases = await NotificationPhrase.findAll({ where: { user_id: req.user.id }, transaction })
      await protectSelectedStyle(req.user.id, row, phrases, transaction)
      await row.destroy({ transaction }); await bumpRevision(req.user.id, transaction)
    })
    return res.status(204).end()
  } catch (error) { return next(error) }
}
