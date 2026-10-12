import { deleteOwnAccount } from '../services/accountDeletion.js'
import { UniqueConstraintError } from 'sequelize'
import { hashPassword } from '../helpers/password.js'
import { User } from '../models/index.js'
import { createHttpError } from '../utils/httpError.js'

export const createUser = async (req, res, next) => {
  try {
    const password = await hashPassword(req.body.password)
    const user = await User.create({ email: req.body.email.toLowerCase(), password })

    return res.status(201).json({ id: user.id, email: user.email })
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return next(createHttpError(409, 'El email ya está registrado'))
    }

    return next(error)
  }
}

export const getUser = async (req, res, next) => {
  try {
    if (req.user.id !== Number(req.params.id)) {
      throw createHttpError(403, 'No tienes permiso para consultar este usuario')
    }

    const user = await User.findByPk(req.params.id, { attributes: ['id', 'email'] })

    if (!user) {
      throw createHttpError(404, 'El usuario no fue encontrado')
    }

    return res.json(user)
  } catch (error) {
    return next(error)
  }
}

export const deleteAccount = async (req, res, next) => {
  try {
    await deleteOwnAccount(req.user.id, req.body.password, req.body.confirmation)
    return res.status(204).end()
  } catch (error) { return next(error) }
}
