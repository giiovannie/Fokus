import { body, param, query } from 'express-validator'
export const adminListValidator = [
  query('page').optional().isInt({ min: 1, max: 100000 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().isString().trim().isLength({ max: 160 }),
  query('sort').optional().isIn(['id', 'email', 'createdAt', 'role', 'status', 'frequency']),
  query('direction').optional().isIn(['ASC', 'DESC']),
  query('role').optional().isIn(['student', 'superadmin']),
  query('status').optional().isIn(['active', 'suspended']),
]
export const adminIdValidator = [param('id').isInt({ min: 1, max: 4294967295 }).toInt()]
export const adminStatusValidator = [
  body('status').isIn(['active', 'suspended']),
  body('confirmation').equals('CONFIRMAR'),
  body('reason').optional().isString().trim().isLength({ max: 500 }).bail().custom(value => !/[\x00-\x1f\x7f]/.test(value)),
  body().custom(value => value && Object.keys(value).every(key => ['status', 'reason', 'confirmation'].includes(key))),
]
