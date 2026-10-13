import { body } from 'express-validator'
export const onboardingValidator = [
  body().custom(value => value && !Array.isArray(value) && Object.keys(value).every(key => ['status', 'step', 'revision'].includes(key))),
  body('status').isIn(['in_progress', 'paused', 'skipped', 'completed']),
  body('step').custom(Number.isInteger).isInt({ min: 0, max: 7 }).custom((value, { req }) => req.body.status !== 'completed' || value === 7),
  body('revision').custom(Number.isInteger).isInt({ min: 0, max: 2147483646 }),
]
