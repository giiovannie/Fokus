import { matchedData } from 'express-validator'
import { Op } from 'sequelize'
import { AdminEvent, User, Profile, Subject, Teacher, sequelize } from '../models/index.js'
import { createHttpError } from '../utils/httpError.js'
import { ReminderRepository } from '../services/reminderRepository.js'
import { deleteOwnAccount } from '../services/accountDeletion.js'

const attributes = ['id', 'email', 'role', 'status', 'createdAt']
const publicUser = row => ({ id: row.id, email: row.email, role: row.role, status: row.status,
  createdAt: row.createdAt, username: row.profile?.nickname || null })

export const getAdminUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', role, status, sort = 'createdAt', direction = 'DESC' } = matchedData(req)
    if (sort === 'frequency') throw createHttpError(400, 'El ordenamiento no es válido para usuarios')
    const where = { ...(role && { role }), ...(status && { status }) }
    if (search) {
      const pattern = '%' + search.replace(/[\\%_]/g, character => '\\' + character) + '%'
      where[Op.or] = [{ email: { [Op.like]: pattern } }, { '$profile.nickname$': { [Op.like]: pattern } },
        { '$profile.name$': { [Op.like]: pattern } }, { '$profile.last_name$': { [Op.like]: pattern } },
        ...(/^\d+$/.test(search) ? [{ id: Number(search) }] : [])]
    }
    const { count, rows } = await User.findAndCountAll({ where, attributes,
      include: [{ model: Profile, as: 'profile', attributes: ['nickname'], required: false }],
      order: [[sort, direction], ['id', direction]], limit, offset: (page - 1) * limit, subQuery: false, distinct: true })
    res.set('Cache-Control', 'no-store')
    return res.json({ users: rows.map(publicUser), total: count, page, limit, totalPages: Math.ceil(count / limit) })
  } catch (error) { return next(error) }
}

export const getAdminUser = async (req, res, next) => {
  try {
    const { id } = matchedData(req)
    const user = await User.findByPk(id, { attributes, include: [{ model: Profile, as: 'profile', attributes: ['nickname'] }] })
    if (!user) throw createHttpError(404, 'La cuenta no fue encontrada')
    const [subjects, teachers, events] = await Promise.all([
      Subject.count({ where: { user_id: id } }), Teacher.count({ where: { user_id: id } }),
      AdminEvent.findAll({ where: { target_id: id }, attributes: ['id', 'actor_id', 'action', 'reason', 'createdAt'], limit: 20, order: [['id', 'DESC']] }),
    ])
    res.set('Cache-Control', 'no-store')
    return res.json({ user: publicUser(user), totals: { subjects, teachers }, events,
      activity_note: 'No se registra la última visita ni el último inicio de sesión.' })
  } catch (error) { return next(error) }
}

export const updateAdminUserStatus = async (req, res, next) => {
  try {
    const { id, status, reason = '' } = matchedData(req)
    if (id === req.user.id) throw createHttpError(403, 'No podés cambiar el estado de tu propia cuenta')
    // Serializar con el worker garantiza que no haya envíos después de confirmar el bloqueo.
    const result = await new ReminderRepository().withRunLock(async assertOwned => sequelize.transaction(async transaction => {
      const actor = await User.findByPk(req.user.id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!actor || actor.role !== 'superadmin' || actor.status === 'suspended') throw createHttpError(403, 'No tenés permiso para administrar cuentas')
      const user = await User.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!user) throw createHttpError(404, 'La cuenta no fue encontrada')
      if (user.status !== status) {
        await assertOwned()
        await user.update({ status }, { transaction })
        await AdminEvent.create({ actor_id: req.user.id, target_id: id, action: status === 'suspended' ? 'suspend' : 'reactivate', reason: reason || null }, { transaction })
      }
      await assertOwned()
      return { id, status }
    }))
    if (result?.skipped) throw createHttpError(409, 'Hay un lote de recordatorios en curso. Volvé a intentar en unos segundos.')
    return res.json(result)
  } catch (error) { return next(error) }
}

export const deleteAdminUser = async (req, res, next) => {
  try {
    const { id, password, confirmation } = matchedData(req)
    if (id === req.user.id) throw createHttpError(403, 'No podés eliminar tu propia cuenta desde la administración')
    await deleteOwnAccount(id, password, confirmation, req.user.id)
    return res.status(204).end()
  } catch (error) { return next(error) }
}
