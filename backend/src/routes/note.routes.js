import { Router } from 'express'
import { deleteTaskNote, updateTaskNote } from '../controllers/taskNote.controller.js'
import { authenticate, requireStudent } from '../middlewares/auth.middleware.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import { noteBodyValidator, noteIdValidator } from '../validators/taskNote.validator.js'

const router = Router()

router.use(authenticate, requireStudent)
router.put('/:id', noteIdValidator, noteBodyValidator, validateRequest, updateTaskNote)
router.delete('/:id', noteIdValidator, validateRequest, deleteTaskNote)

export { router as noteRouter }
