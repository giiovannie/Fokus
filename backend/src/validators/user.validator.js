import { body, param } from 'express-validator'

export const createUserValidator = [
  body('email').isEmail().withMessage('El email no es válido').normalizeEmail(),
  body('password')
    .isLength({ min: 8, max: 72 })
    .withMessage('La contraseña debe tener entre 8 y 72 caracteres'),
]

export const userIdValidator = [
  param('id').isInt({ min: 1 }).withMessage('El usuario no es válido'),
]

export const deleteAccountValidator = [
  body('password').isString().isLength({ min: 1, max: 72 }).withMessage('Ingresá tu contraseña actual'),
  body('confirmation').equals('ELIMINAR').withMessage('Escribí ELIMINAR para confirmar'),
  body().custom(value => value && Object.keys(value).every(key => ['password', 'confirmation'].includes(key))).withMessage('Solo podés eliminar tu propia cuenta'),
]
