import { Router } from 'express'
import { registrationLimiter } from '../middlewares/rateLimit.middleware.js'
import { createUser, getUser } from '../controllers/user.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import { createUserValidator, userIdValidator } from '../validators/user.validator.js'

const router = Router()

router.post('/', registrationLimiter, createUserValidator, validateRequest, createUser)
router.get('/:id', authenticate, userIdValidator, validateRequest, getUser)

export { router as userRouter }
