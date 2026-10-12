import { comparePassword } from '../helpers/password.js'
import { generateToken } from '../helpers/token.js'
import { User } from '../models/index.js'
import { createHttpError } from '../utils/httpError.js'

export const login = async (req, res, next) => {
  try {
    const user = await User.findOne({ where: { email: req.body.email.toLowerCase() } })
    const validPassword = user && await comparePassword(req.body.password, user.password)

    if (!validPassword) {
      throw createHttpError(401, 'Credenciales incorrectas')
    }
    if (user.status === 'suspended') throw createHttpError(403, 'Tu cuenta está suspendida. Contactá al administrador.')

    return res.json({
      user: { id: user.id, email: user.email, role: user.role ?? 'student' },
      token: generateToken(user.id),
    })
  } catch (error) {
    return next(error)
  }
}
