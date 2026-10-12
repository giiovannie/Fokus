import { Router } from 'express'
import {
  createStudyActivity,
  getStudyActivities,
  updateStudyActivityStatus,
} from '../controllers/studyActivity.controller.js'
import { authenticate, requireStudent } from '../middlewares/auth.middleware.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import {
  activityIdValidator,
  activityStatusValidator,
  createActivityValidator,
} from '../validators/studyActivity.validator.js'

const router = Router()

router.use(authenticate, requireStudent)
router.get('/', getStudyActivities)
router.post('/', createActivityValidator, validateRequest, createStudyActivity)
router.patch('/:id/status', activityIdValidator, activityStatusValidator, validateRequest, updateStudyActivityStatus)

export { router as studyActivityRouter }
