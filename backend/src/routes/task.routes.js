import { Router } from 'express'
import {
  createTask,
  deleteTask,
  getTask,
  getTasks,
  updateTask,
  updateTaskStatus,
} from '../controllers/task.controller.js'
import { authenticate, requireStudent } from '../middlewares/auth.middleware.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import {
  createTaskValidator,
  taskIdValidator,
  taskStatusValidator,
  updateTaskValidator,
} from '../validators/task.validator.js'
import { createTaskNote, getTaskNotes } from '../controllers/taskNote.controller.js'
import { noteBodyValidator, taskNoteTaskIdValidator } from '../validators/taskNote.validator.js'

const router = Router()

router.use(authenticate, requireStudent)
router.get('/', getTasks)
router.get('/:taskId/notes', taskNoteTaskIdValidator, validateRequest, getTaskNotes)
router.post('/:taskId/notes', taskNoteTaskIdValidator, noteBodyValidator, validateRequest, createTaskNote)
router.get('/:id', taskIdValidator, validateRequest, getTask)
router.post('/', createTaskValidator, validateRequest, createTask)
router.put('/:id', taskIdValidator, updateTaskValidator, validateRequest, updateTask)
router.patch('/:id/status', taskIdValidator, taskStatusValidator, validateRequest, updateTaskStatus)
router.delete('/:id', taskIdValidator, validateRequest, deleteTask)

export { router as taskRouter }
