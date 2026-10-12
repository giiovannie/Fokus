import { Op } from 'sequelize'
import { comparePassword } from '../helpers/password.js'
import { Profile, Subject, Teacher, User, NotificationReminder, NotificationWorkerState, NotificationDelivery, PushSubscription, sequelize } from '../models/index.js'
import { ReminderRepository } from './reminderRepository.js'
import { deleteAccountAvatars, getOwnedAvatarId } from './cloudinary.service.js'
import { createHttpError } from '../utils/httpError.js'

export const deleteOwnAccount = async (userId, password, confirmation) => {
  if (confirmation !== 'ELIMINAR') throw createHttpError(400, 'Escribí ELIMINAR para confirmar')
  // Compartir el bloqueo existente impide borrar mientras un lote envía Push.
  const result = await new ReminderRepository().withRunLock(async assertOwned => sequelize.transaction(async transaction => {
    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE })
    if (!user || !await comparePassword(password, user.password)) throw createHttpError(403, 'La contraseña actual no es correcta')
    const teachers = await Teacher.findAll({ where: { user_id: userId }, attributes: ['id'], transaction })
    if (teachers.length && await Subject.count({ where: { teacher_id: { [Op.in]: teachers.map(row => row.id) }, user_id: { [Op.ne]: userId } }, transaction })) {
      throw createHttpError(409, 'Hay relaciones con otra cuenta. Se requiere una revisión antes de eliminar.')
    }
    const crossedDeliveries = await NotificationDelivery.count({ include: [
      { model: PushSubscription, as: 'subscription', required: true, where: { user_id: userId } },
      { model: NotificationReminder, as: 'reminder', required: true, where: { user_id: { [Op.ne]: userId } } },
    ], transaction })
    if (crossedDeliveries) throw createHttpError(409, 'Hay relaciones con otra cuenta. Se requiere una revisión antes de eliminar.')
    const profile = await Profile.findOne({ where: { user_id: userId }, transaction, lock: transaction.LOCK.UPDATE })
    const avatarId = profile?.avatar_url && getOwnedAvatarId(profile.avatar_url, userId, profile.id)
    // No borrar fotos externas o de otra cuenta; requerir revisión en vez de omitirlas.
    if (profile?.avatar_url && !avatarId) throw createHttpError(409, 'No pudimos verificar la foto. Contactá al administrador antes de eliminar la cuenta.')
    await assertOwned()
    await deleteAccountAvatars(userId, { required: !!avatarId })
    await assertOwned()
    await NotificationReminder.update({ status: 'cancelled', cancellation_reason: 'account_deleted' }, { where: { user_id: userId, status: 'pending' }, transaction })
    await NotificationWorkerState.destroy({ where: { scope: ['events:' + userId + ':exam', 'events:' + userId + ':task'] }, transaction })
    // CASCADE elimina notas, tareas, exámenes y actividades; no tocar filas ajenas.
    await Subject.destroy({ where: { user_id: userId }, transaction })
    await Teacher.destroy({ where: { user_id: userId }, transaction })
    // Las FK de users eliminan perfil, preferencias, frases, reglas, suscripciones,
    // recordatorios/entregas y eliminaciones de bandeja dentro de la transacción.
    await user.destroy({ transaction })
    await assertOwned()
    return { deleted: true }
  }))
  if (result?.skipped) throw createHttpError(409, 'Hay un lote de recordatorios en curso. Esperá unos segundos y volvé a intentar.')
  return result
}
