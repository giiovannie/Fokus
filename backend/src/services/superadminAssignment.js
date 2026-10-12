import { User, sequelize } from '../models/index.js'
import { comparePassword } from '../helpers/password.js'
import { createHttpError } from '../utils/httpError.js'
export const approvedAdminEmail = 'ivanemmanuelgomez2017@gmail.com'
export const assignSuperadmin = async ({ userId, password, confirmed, identityVerified }) => {
  if (!confirmed || !identityVerified || !Number.isSafeInteger(userId) || userId < 1) throw createHttpError(400, 'Se requiere confirmación e identidad de una cuenta existente')
  return sequelize.transaction(async transaction => {
    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE })
    if (!user || user.email.toLowerCase() !== approvedAdminEmail || !await comparePassword(password, user.password)) {
      throw createHttpError(403, 'No se pudo verificar la identidad de la cuenta administradora')
    }
    await user.update({ role: 'superadmin' }, { transaction })
  })
}
