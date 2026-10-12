import { Router } from 'express'
import {
  createSubject,
  deleteSubject,
  getSubject,
  getSubjects,
  updateSubject,
} from '../controllers/subject.controller.js'
import { authenticate, requireStudent } from '../middlewares/auth.middleware.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import { subjectBodyValidator, subjectIdValidator } from '../validators/subject.validator.js'
import { getSubjectTasks } from '../controllers/task.controller.js'
import { taskSubjectIdValidator } from '../validators/task.validator.js'
import { getSubjectExams } from '../controllers/exam.controller.js'
import { examSubjectIdValidator } from '../validators/exam.validator.js'

const router = Router()

router.use(authenticate, requireStudent)
router.get('/', getSubjects)
router.get('/:subjectId/tasks', taskSubjectIdValidator, validateRequest, getSubjectTasks)
router.get('/:subjectId/exams', examSubjectIdValidator, validateRequest, getSubjectExams)
router.get('/:id', subjectIdValidator, validateRequest, getSubject)
router.post('/', subjectBodyValidator, validateRequest, createSubject)
router.put('/:id', subjectIdValidator, subjectBodyValidator, validateRequest, updateSubject)
router.delete('/:id', subjectIdValidator, validateRequest, deleteSubject)

export { router as subjectRouter }
