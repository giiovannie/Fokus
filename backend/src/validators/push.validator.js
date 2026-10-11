import { body } from 'express-validator'
import { validatePushSubscription } from '../config/webPush.js'
export const subscriptionValidator = [
  body().custom(value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => ['device_id', 'device_label', 'subscription'].includes(key))),
  body('device_id').isUUID(4).withMessage('El identificador del dispositivo no es válido'),
  body('device_label').optional().isString().bail().trim().isLength({ min: 1, max: 100 }).bail().custom(value => !/[\u0000-\u001f\u007f-\u009f]/u.test(value)),
  body('subscription').custom(validatePushSubscription).withMessage('La suscripción Push no es válida o su proveedor no está admitido'),
]
