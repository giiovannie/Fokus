import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate, requireSuperadmin } from '../middlewares/auth.middleware.js'
import { getAdminStatistics } from '../controllers/admin.controller.js'
import { getAdminUsers, getAdminUser, updateAdminUserStatus, deleteAdminUser } from '../controllers/adminUsers.controller.js'
import { getAdminSubjects, getAdminSystem } from '../controllers/adminSystem.controller.js'
import { adminListValidator, adminIdValidator, adminStatusValidator } from '../validators/admin.validator.js'
import { deleteAccountValidator } from '../validators/user.validator.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import { accountDeletionLimiter } from '../middlewares/rateLimit.middleware.js'
const router = Router()
router.use(authenticate, requireSuperadmin)
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
router.use(rateLimit({ windowMs: 60000, limit: 100, keyGenerator: req => String(req.user.id), standardHeaders: 'draft-7', legacyHeaders: false }))
router.get('/users', adminListValidator, validateRequest, getAdminUsers)
router.get('/users/:id', adminIdValidator, validateRequest, getAdminUser)
router.patch('/users/:id/status', adminIdValidator, adminStatusValidator, validateRequest, updateAdminUserStatus)
router.delete('/users/:id', accountDeletionLimiter, adminIdValidator, deleteAccountValidator, validateRequest, deleteAdminUser)
router.get('/subjects', adminListValidator, validateRequest, getAdminSubjects)
router.get('/system', getAdminSystem)
router.get('/statistics', rateLimit({ windowMs: 60000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }), getAdminStatistics)
export { router as adminRouter }
