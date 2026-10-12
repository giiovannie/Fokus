import { matchedData } from 'express-validator'
import { col, fn } from 'sequelize'
import { Subject, NotificationReminder, NotificationDelivery, sequelize } from '../models/index.js'
import { isReminderWorkerEnabled } from '../config/reminderWorker.js'
import { createHttpError } from '../utils/httpError.js'

export const normalizeSubjectName = name => name.normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/gu, ' ').toLowerCase()
export const getAdminSubjects = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', direction = 'DESC', sort = 'frequency' } = matchedData(req)
    if (sort !== 'frequency') throw createHttpError(400, 'El ordenamiento no es válido para materias')
    // Agrupar primero en SQL reduce transferencias; BINARY conserva las variantes reales.
    const groups = new Map()
    const batchSize = 500
    for (let offset = 0; ; offset += batchSize) {
      const rows = await Subject.findAll({ attributes: [[fn('MIN', col('name')), 'name'], [fn('COUNT', col('id')), 'frequency']],
        group: [fn('BINARY', col('name'))], order: [[fn('BINARY', col('name')), 'ASC']], limit: batchSize, offset, raw: true })
      for (const row of rows) {
        const key = normalizeSubjectName(row.name)
        const item = groups.get(key) || { key, name: row.name.trim().replace(/\s+/gu, ' '), frequency: 0, variant_count: 0, variants: [] }
        item.frequency += Number(row.frequency)
        item.variant_count++
        if (item.variants.length < 20) item.variants.push(row.name)
        groups.set(key, item)
      }
      if (rows.length < batchSize) break
    }
    const all = [...groups.values()].sort((a, b) => b.frequency - a.frequency || a.key.localeCompare(b.key))
    const filtered = all.filter(item => item.key.includes(normalizeSubjectName(search)))
    if (direction === 'ASC') filtered.reverse()
    res.set('Cache-Control', 'no-store')
    return res.json({ subjects: filtered.slice((page - 1) * limit, page * limit), total: filtered.length,
      totalUnique: all.length, totalRegistrations: all.reduce((sum, item) => sum + item.frequency, 0),
      topSubjects: all.slice(0, 5).map(({ name, frequency }) => ({ name, frequency })), page, limit, totalPages: Math.ceil(filtered.length / limit) })
  } catch (error) { return next(error) }
}

export const getAdminSystem = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    try { await sequelize.authenticate() } catch {
      return res.json({ api: 'ok', database: 'unavailable', application_version: 'Beta 0.1', notifications: null, generated_at: new Date().toISOString() })
    }
    const [pending, failed, sent] = await Promise.all([
      NotificationReminder.count({ where: { status: 'pending' } }),
      NotificationDelivery.count({ where: { status: 'failed' } }),
      NotificationDelivery.count({ where: { status: 'sent' } }),
    ])
    return res.json({ api: 'ok', database: 'ok', application_version: 'Beta 0.1',
      notifications: { enabled: isReminderWorkerEnabled(), pending, failed, sent,
        note: 'Conteos persistidos de entregas y recordatorios. No confirman lectura; no hay un historial global de errores de la API.' }, generated_at: new Date().toISOString() })
  } catch (error) { return next(error) }
}
