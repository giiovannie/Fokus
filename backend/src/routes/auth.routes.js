import { Router } from 'express'
import { login } from '../controllers/auth.controller.js'
import { loginLimiter } from '../middlewares/rateLimit.middleware.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import { loginValidator } from '../validators/auth.validator.js'

const router = Router()

router.post('/login', loginLimiter, loginValidator, validateRequest, login)

export { router as authRouter }
