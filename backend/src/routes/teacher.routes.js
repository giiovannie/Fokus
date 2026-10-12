import { Router } from 'express'
import { createTeacher, getTeachers } from '../controllers/teacher.controller.js'
import { authenticate, requireStudent } from '../middlewares/auth.middleware.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import { createTeacherValidator } from '../validators/teacher.validator.js'

const router = Router()

router.use(authenticate, requireStudent)
router.get('/', getTeachers)
router.post('/', createTeacherValidator, validateRequest, createTeacher)

export { router as teacherRouter }
