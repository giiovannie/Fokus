import { body, param } from 'express-validator'

export const examIdValidator = [param('id').isInt({ min: 1 }).withMessage('El examen no es válido')]
export const examSubjectIdValidator = [param('subjectId').isInt({ min: 1 }).withMessage('La materia no es válida')]

export const createExamValidator = [
  body('title').trim().notEmpty().withMessage('El título es obligatorio').isLength({ max: 180 }),
  body('exam_time').optional({ nullable: true }).isString().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('La hora debe usar HH:mm'),
  body('exam_date').matches(/^\d{4}-\d{2}-\d{2}$/).isISO8601({ strict: true }).withMessage('La fecha debe usar YYYY-MM-DD'),
  body('topics').optional({ nullable: true }).isString(),
  body('subject_id').isInt({ min: 1 }).withMessage('La materia es obligatoria'),
]

export const updateExamValidator = [
  body('title').optional().trim().notEmpty().isLength({ max: 180 }),
  body('exam_time').optional({ nullable: true }).isString().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('La hora debe usar HH:mm'),
  body('exam_date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).isISO8601({ strict: true }).withMessage('La fecha debe usar YYYY-MM-DD'),
  body('topics').optional({ nullable: true }).isString(),
  body('subject_id').optional().isInt({ min: 1 }),
]

export const examGradeValidator = [
  body('grade').isFloat({ min: 0, max: 10 }).withMessage('La calificación debe estar entre 0 y 10'),
]
