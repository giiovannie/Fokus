import { Router } from 'express'
import { getUpcoming } from '../controllers/dashboard.controller.js'
import { authenticate, requireStudent } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/upcoming', authenticate, requireStudent, getUpcoming)

export { router as dashboardRouter }
