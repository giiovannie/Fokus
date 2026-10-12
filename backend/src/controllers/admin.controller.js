import { Op, fn, col, QueryTypes } from 'sequelize'
import { User, Subject, Task, Exam, sequelize } from '../models/index.js'

export const getAdminStatistics = async (req, res, next) => {
  try {
    const now = new Date(), since = new Date(now.getTime() - 7 * 86400000)
    const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29))
    const [users, subjects, tasks, exams, registrationsWeek, history, active] = await Promise.all([
      User.count(), Subject.count(), Task.count(), Exam.count(),
      User.count({ where: { createdAt: { [Op.gte]: since } } }),
      User.findAll({ attributes: [[fn('DATE', col('created_at')), 'day'], [fn('COUNT', col('id')), 'count']],
        where: { createdAt: { [Op.gte]: firstDay } }, group: [fn('DATE', col('created_at'))], order: [[fn('DATE', col('created_at')), 'ASC']], raw: true }),
      sequelize.query(`SELECT COUNT(DISTINCT changes.user_id) AS count FROM (
        SELECT user_id FROM subjects WHERE updated_at >= :since
        UNION ALL SELECT s.user_id FROM tasks t JOIN subjects s ON s.id = t.subject_id WHERE t.updated_at >= :since
        UNION ALL SELECT s.user_id FROM exams e JOIN subjects s ON s.id = e.subject_id WHERE e.updated_at >= :since
        UNION ALL SELECT s.user_id FROM study_activities a JOIN subjects s ON s.id = a.subject_id WHERE a.updated_at >= :since
      ) AS changes`, { replacements: { since }, type: QueryTypes.SELECT, logging: false }),
    ])
    const counts = new Map(history.map(row => [row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10), Number(row.count)]))
    const registrationHistory = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(firstDay.getTime() + index * 86400000).toISOString().slice(0, 10)
      return { day, count: counts.get(day) ?? 0 }
    })
    res.set('Cache-Control', 'no-store')
    return res.json({ totals: { users, subjects, tasks, exams }, registrations_last_7_days: registrationsWeek,
      active_users_last_7_days: Number(active[0]?.count ?? 0),
      activity_definition: 'Usuarios con al menos una creación o modificación de materia, tarea, examen o actividad de estudio en los últimos 7 días. No mide visitas ni inicios de sesión.',
      registration_history: registrationHistory, timezone: 'UTC', generated_at: now.toISOString() })
  } catch (error) { return next(error) }
}
