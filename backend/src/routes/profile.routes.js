import { Router } from 'express'
import { avatarLimiter } from '../middlewares/rateLimit.middleware.js'
import { createProfile, getProfile, updateProfile, updateProfileAvatar } from '../controllers/profile.controller.js'
import { authorizeProfileAvatar, uploadProfileAvatar, validateProfileAvatar } from '../middlewares/profileAvatar.middleware.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import {
  createProfileValidator,
  profileIdValidator,
  profileUserIdValidator,
  updateProfileValidator,
} from '../validators/profile.validator.js'

const router = Router()

router.use(authenticate)
router.post('/:id/avatar', avatarLimiter, profileIdValidator, validateRequest, authorizeProfileAvatar, uploadProfileAvatar, validateProfileAvatar, updateProfileAvatar)
router.get('/:userId', profileUserIdValidator, validateRequest, getProfile)
router.post('/', createProfileValidator, validateRequest, createProfile)
router.put('/:id', profileIdValidator, updateProfileValidator, validateRequest, updateProfile)

export { router as profileRouter }
