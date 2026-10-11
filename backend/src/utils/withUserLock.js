import { User, sequelize } from '../models/index.js'
import { createHttpError } from './httpError.js'
export const withUserLock = (userId, action) => sequelize.transaction(async transaction => {
  const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE })
  if (!user) throw createHttpError(401, 'El usuario ya no existe')
  return action(transaction)
})
