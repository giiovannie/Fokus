import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate, requireSuperadmin } from '../middlewares/auth.middleware.js'
import { getAdminStatistics } from '../controllers/admin.controller.js'
const router = Router()
router.use(authenticate, requireSuperadmin)
router.get('/statistics', rateLimit({ windowMs: 60000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }), getAdminStatistics)
export { router as adminRouter }
