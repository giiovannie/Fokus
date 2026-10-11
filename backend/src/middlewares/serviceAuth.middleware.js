import { createHash, timingSafeEqual } from 'node:crypto'
import { isReminderWorkerEnabled } from '../config/reminderWorker.js'
const hash = value => createHash('sha256').update(value).digest()
export const authenticateNotificationService = (req, res, next) => {
  const expected = process.env.NOTIFICATION_SERVICE_TOKEN
  const token = req.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1]
  if (!expected || expected.length < 32 || !token || !timingSafeEqual(hash(token), hash(expected))) return res.status(401).json({ message: 'Servicio no autorizado' })
  if (!isReminderWorkerEnabled()) return res.status(503).json({ message: 'El procesamiento automático todavía no está habilitado.' })
  return next()
}
