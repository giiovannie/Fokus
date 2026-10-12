import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticateNotificationService } from '../middlewares/serviceAuth.middleware.js'
import { runReminderWorker } from '../services/runReminderWorker.js'
import { reminderWorkerDiagnostic } from '../utils/reminderWorkerDiagnostic.js'
const router = Router()
const limiter = rateLimit({ windowMs: 60000, limit: 6, keyGenerator: () => 'notification-service', standardHeaders: 'draft-7', legacyHeaders: false })
router.post('/notifications/process', authenticateNotificationService, limiter, async (req, res, next) => {
  if (req.body && (Array.isArray(req.body) || Object.keys(req.body).length)) return res.status(400).json({ message: 'Este servicio no acepta parámetros de estudiantes ni límites personalizados.' })
  try {
    const started = Date.now()
    const report = await runReminderWorker()
    const keys = ['plannedEvents', 'reconciled', 'sent', 'retried', 'failed', 'cancelled', 'deliveriesAttempted']
    const counters = Object.fromEntries(keys.filter(key => Number.isSafeInteger(report?.[key]) && report[key] >= 0).map(key => [key, report[key]]))
    if (report?.skipped === 'busy') counters.skipped = 'busy'
    console.info('notification_worker_completed', { ...counters, duration_ms: Date.now() - started })
    return res.json(report)
  }
  catch (error) {
    console.error('notification_worker_failed', reminderWorkerDiagnostic(error))
    return next(Object.assign(new Error('No se pudo procesar el lote. Revisá la configuración y las migraciones del servicio.'), { status: 503 }))
  }
})
export { router as notificationWorkerRouter }
