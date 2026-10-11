import { body, param, query } from 'express-validator'
import { notificationDefaults, notificationStyles, maxOffsetMinutes } from '../config/notificationPreferences.js'
const time = /^([01]\d|2[0-3]):[0-5]\d$/
export const preferenceValidator = [
  body().custom(value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => Object.hasOwn(notificationDefaults, key))),
  ...['enabled', 'exams_enabled', 'tasks_enabled', 'unfiltered_enabled', 'quiet_hours_enabled'].map(key => body(key).custom(value => typeof value === 'boolean')),
  body('timezone').isString().isLength({ min: 1, max: 100 }).custom(value => {
    if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+$/.test(value)) return false
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false }
  }),
  ...['exam_default_time', 'task_default_time'].map(key => body(key).isString().matches(time)),
  ...['exam_style', 'task_style'].map(key => body(key).isIn(notificationStyles)),
  ...['quiet_start', 'quiet_end'].map(key => body(key).custom(value => value === null || (typeof value === 'string' && time.test(value)))),
  body().custom(value => {
    if (!value.unfiltered_enabled && [value.exam_style, value.task_style].includes('unfiltered')) return false
    return value.quiet_hours_enabled
      ? time.test(value.quiet_start) && time.test(value.quiet_end) && value.quiet_start !== value.quiet_end
      : value.quiet_start === null && value.quiet_end === null
  }).withMessage('El silencio o el consentimiento no son coherentes'),
]
export const ruleValidator = [
  body().custom(value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => ['event_type', 'amount', 'unit', 'enabled'].includes(key))),
  body('event_type').isIn(['exam', 'task']),
  body('amount').custom(value => Number.isInteger(value) && value >= 0),
  body('unit').isIn(['minutes', 'hours', 'days']),
  body('enabled').custom(value => typeof value === 'boolean'),
  body().custom(value => value.amount * ({ minutes: 1, hours: 60, days: 1440 }[value.unit] || NaN) <= maxOffsetMinutes).withMessage('La anticipación máxima es de 30 días'),
]
export const ruleIdValidator = [param('id').isInt({ min: 1 })]
export const ruleListValidator = [query('event_type').optional().isIn(['exam', 'task'])]
