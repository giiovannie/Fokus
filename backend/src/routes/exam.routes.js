import { Router } from 'express'
import {
  createExam,
  deleteExam,
  getExam,
  getExams,
  updateExam,
  updateExamGrade,
} from '../controllers/exam.controller.js'
import { authenticate, requireStudent } from '../middlewares/auth.middleware.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import {
  createExamValidator,
  examGradeValidator,
  examIdValidator,
  updateExamValidator,
} from '../validators/exam.validator.js'

const router = Router()

router.use(authenticate, requireStudent)
router.get('/', getExams)
router.get('/:id', examIdValidator, validateRequest, getExam)
router.post('/', createExamValidator, validateRequest, createExam)
router.put('/:id', examIdValidator, updateExamValidator, validateRequest, updateExam)
router.patch('/:id/grade', examIdValidator, examGradeValidator, validateRequest, updateExamGrade)
router.delete('/:id', examIdValidator, validateRequest, deleteExam)

export { router as examRouter }
