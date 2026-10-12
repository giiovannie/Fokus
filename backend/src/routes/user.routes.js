import { Router } from 'express'
import { registrationLimiter, accountDeletionLimiter } from '../middlewares/rateLimit.middleware.js'
import { createUser, getUser, deleteAccount } from '../controllers/user.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import { createUserValidator, userIdValidator, deleteAccountValidator } from '../validators/user.validator.js'

const router = Router()

router.post('/', registrationLimiter, createUserValidator, validateRequest, createUser)
router.delete('/me', authenticate, accountDeletionLimiter, deleteAccountValidator, validateRequest, deleteAccount)
router.get('/:id', authenticate, userIdValidator, validateRequest, getUser)

export { router as userRouter }
