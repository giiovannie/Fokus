import rateLimit from 'express-rate-limit'
import { subscriptionValidator } from '../validators/push.validator.js'
import { getPushConfig, listPushSubscriptions, savePushSubscription, deletePushSubscription, sendPushTest } from '../controllers/push.controller.js'
import { Router } from 'express'
import { getNotificationPhrases, createNotificationPhrase, updateNotificationPhrase, deleteNotificationPhrase } from '../controllers/notificationPhrases.controller.js'
import { getNotificationPreferences, putNotificationPreferences, getNotificationRules, createNotificationRule, updateNotificationRule, deleteNotificationRule } from '../controllers/notificationPreferences.controller.js'
import { previewValidator, phraseValidator, preferenceValidator, ruleValidator, ruleIdValidator, ruleListValidator } from '../validators/notification.validator.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import { getNotifications, previewNotification } from '../controllers/notification.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const router = Router()

router.use(authenticate)
const pushTestLimiter = rateLimit({ windowMs: 60000, limit: 30, keyGenerator: req => String(req.user.id), standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Hiciste demasiadas pruebas. Esperá un minuto antes de volver a intentar.' } })
router.get('/push/config', getPushConfig)
router.get('/push/subscriptions', listPushSubscriptions)
router.post('/push/subscriptions', subscriptionValidator, validateRequest, savePushSubscription)
router.delete('/push/subscriptions/:id', ruleIdValidator, validateRequest, deletePushSubscription)
router.post('/push/test/:id', pushTestLimiter, ruleIdValidator, previewValidator, validateRequest, sendPushTest)
router.get('/', getNotifications)
router.post('/preview', previewValidator, validateRequest, previewNotification)
router.get('/preferences', getNotificationPreferences)
router.put('/preferences', preferenceValidator, validateRequest, putNotificationPreferences)
router.get('/rules', ruleListValidator, validateRequest, getNotificationRules)
router.post('/rules', ruleValidator, validateRequest, createNotificationRule)
router.put('/rules/:id', ruleIdValidator, ruleValidator, validateRequest, updateNotificationRule)
router.delete('/rules/:id', ruleIdValidator, validateRequest, deleteNotificationRule)

router.get('/phrases', ruleListValidator, validateRequest, getNotificationPhrases)
router.post('/phrases', phraseValidator, validateRequest, createNotificationPhrase)
router.put('/phrases/:id', ruleIdValidator, phraseValidator, validateRequest, updateNotificationPhrase)
router.delete('/phrases/:id', ruleIdValidator, validateRequest, deleteNotificationPhrase)

export { router as notificationRouter }
