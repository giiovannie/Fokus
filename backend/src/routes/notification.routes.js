import { Router } from 'express'
import { getNotificationPreferences, putNotificationPreferences, getNotificationRules, createNotificationRule, updateNotificationRule, deleteNotificationRule } from '../controllers/notificationPreferences.controller.js'
import { preferenceValidator, ruleValidator, ruleIdValidator, ruleListValidator } from '../validators/notification.validator.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import { getNotifications } from '../controllers/notification.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const router = Router()

router.use(authenticate)
router.get('/', getNotifications)
router.get('/preferences', getNotificationPreferences)
router.put('/preferences', preferenceValidator, validateRequest, putNotificationPreferences)
router.get('/rules', ruleListValidator, validateRequest, getNotificationRules)
router.post('/rules', ruleValidator, validateRequest, createNotificationRule)
router.put('/rules/:id', ruleIdValidator, ruleValidator, validateRequest, updateNotificationRule)
router.delete('/rules/:id', ruleIdValidator, validateRequest, deleteNotificationRule)

export { router as notificationRouter }
