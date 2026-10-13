import { Router } from 'express'
import { authenticate, requireStudent } from '../middlewares/auth.middleware.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import { getCalendar, createAgendaEvent, updateAgendaEvent, deleteAgendaEvent } from '../controllers/calendar.controller.js'
import { calendarRangeValidator, agendaBodyValidator, agendaIdValidator } from '../validators/calendar.validator.js'
export const calendarRouter = Router()
calendarRouter.use(authenticate, requireStudent)
calendarRouter.get('/', calendarRangeValidator, validateRequest, getCalendar)
calendarRouter.post('/events', agendaBodyValidator, validateRequest, createAgendaEvent)
calendarRouter.put('/events/:id', agendaIdValidator, agendaBodyValidator, validateRequest, updateAgendaEvent)
calendarRouter.delete('/events/:id', agendaIdValidator, validateRequest, deleteAgendaEvent)
