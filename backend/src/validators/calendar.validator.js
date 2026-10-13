import { body, param, query } from 'express-validator'
import { Temporal } from '@js-temporal/polyfill'
export const validCalendarDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1000) return false
  try { return Temporal.PlainDate.from(value).toString() === value } catch { return false }
}
export const calendarRangeValidator = [
  query('custom_only').optional().isIn(['true', 'false']),
  query('from').custom(validCalendarDate), query('to').custom(validCalendarDate),
  query('to').custom((to, { req }) => { try { const days = Temporal.PlainDate.from(req.query.from).until(Temporal.PlainDate.from(to)).days; return days >= 0 && days <= 62 } catch { return false } }),
]
export const agendaIdValidator = [param('id').isInt({ min: 1 })]
export const agendaBodyValidator = [
  body().custom(value => value && !Array.isArray(value) && Object.keys(value).every(key => ['title', 'description', 'kind', 'event_date', 'event_time', 'subject_id', 'reminder_minutes'].includes(key))),
  body('title').isString().trim().notEmpty().isLength({ max: 180 }),
  body('description').optional({ nullable: true }).isString().isLength({ max: 5000 }),
  body('kind').isIn(['personal', 'academic']), body('event_date').custom(validCalendarDate),
  body('event_time').custom(value => value === null || typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)),
  body('subject_id').custom((value, { req }) => value === null || req.body.kind === 'academic' && Number.isInteger(value) && value > 0),
  body('reminder_minutes').custom((value, { req }) => value === null || req.body.event_time !== null && [0, 15, 60, 1440].includes(value)),
]
