import { body, param } from 'express-validator'

export const taskIdValidator = [param('id').isInt({ min: 1 }).withMessage('La tarea no es válida')]
export const taskSubjectIdValidator = [param('subjectId').isInt({ min: 1 }).withMessage('La materia no es válida')]

export const createTaskValidator = [
  body('title').trim().notEmpty().withMessage('El título es obligatorio').isLength({ max: 180 }),
  body('description').optional({ nullable: true }).isString(),
  body('due_time').optional({ nullable: true }).isString().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('La hora debe usar HH:mm'),
  body('due_date').matches(/^\d{4}-\d{2}-\d{2}$/).isISO8601({ strict: true }).withMessage('La fecha debe usar YYYY-MM-DD'),
  body('subject_id').isInt({ min: 1 }).withMessage('La materia es obligatoria'),
]

export const updateTaskValidator = [
  body('title').optional().trim().notEmpty().isLength({ max: 180 }),
  body('description').optional({ nullable: true }).isString(),
  body('due_time').optional({ nullable: true }).isString().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('La hora debe usar HH:mm'),
  body('due_date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).isISO8601({ strict: true }).withMessage('La fecha debe usar YYYY-MM-DD'),
  body('subject_id').optional().isInt({ min: 1 }),
]

export const taskStatusValidator = [
  body('status').isIn(['pending', 'in_progress', 'completed']).withMessage('El estado no es válido'),
]
