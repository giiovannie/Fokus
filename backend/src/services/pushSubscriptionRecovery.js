import { Op } from 'sequelize'
import { NotificationDelivery, NotificationReminder } from '../models/index.js'
import { subscriptionHash } from './reminderRepository.js'
import { workerLimits } from '../config/reminderWorker.js'
import { createHttpError } from '../utils/httpError.js'

export const assertSubscriptionNotExpired = async (subscription, transaction) => {
  const expired = await NotificationDelivery.findOne({
    where: { device_id: subscription.device_id, subscription_hash: subscriptionHash(subscription), last_error_code: 'subscription_expired' },
    include: [{ model: NotificationReminder, as: 'reminder', required: true, where: { user_id: subscription.user_id }, attributes: [] }],
    attributes: ['id'], transaction,
  })
  if (expired) throw createHttpError(410, 'Esta suscripción fue rechazada por el proveedor. Reactivá Push para generar una nueva.')
}

// Se ejecuta bajo el bloqueo del worker y la transacción de registro del usuario.
export const recoverExpiredPushDeliveries = async (subscription, transaction, now = new Date()) => {
  const hash = subscriptionHash(subscription)
  const rows = await NotificationDelivery.findAll({
    where: { device_id: subscription.device_id, status: 'failed', last_error_code: 'subscription_expired',
      subscription_hash: { [Op.ne]: hash }, attempts: { [Op.lt]: workerLimits.maxAttempts } },
    include: [{ model: NotificationReminder, as: 'reminder', required: true,
      where: { user_id: subscription.user_id, status: { [Op.in]: ['pending', 'failed', 'processed'] },
        due_at: { [Op.between]: [new Date(now.getTime() - workerLimits.catchUpMs), now] },
        [Op.or]: [
          { event_at: { [Op.gt]: now } },
          { event_type: 'agenda', event_at: { [Op.gte]: new Date(now.getTime() - workerLimits.catchUpMs) } },
        ] } }],
    order: [['id', 'ASC']], limit: workerLimits.deliveries, transaction, lock: transaction.LOCK.UPDATE,
  })
  for (const delivery of rows) {
    // Nunca reabrir aceptadas o inciertas. Conservar el contador total de intentos.
    await delivery.update({ subscription_id: subscription.id, subscription_hash: hash, status: 'pending',
      last_error_code: null, next_attempt_at: now }, { transaction })
    await delivery.reminder.update({ status: 'pending', cancellation_reason: null }, { transaction })
  }
}
