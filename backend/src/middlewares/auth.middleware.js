import { verifyToken } from '../helpers/token.js'
import { User } from '../models/User.js'

export const authenticate = async (req, res, next) => {
  const authorization = req.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Debes iniciar sesión' })
  let id
  try {
    id = Number(verifyToken(token).sub)
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid subject')
  } catch { return res.status(401).json({ message: 'El token no es válido o expiró' }) }
  try {
    // Verificar existencia en cada petición revoca también JWT anteriores al borrado.
    const user = await User.findByPk(id, { attributes: ['id', 'role', 'status'] })
    if (!user) return res.status(401).json({ message: 'El token no es válido o expiró' })
    if (user.status === 'suspended') return res.status(401).json({ message: 'Tu cuenta está suspendida. Contactá al administrador.' })
    req.user = { id: user.id, role: user.role ?? 'student' }
    return next()
  } catch (error) { return next(error) }
}
export const requireSuperadmin = (req, res, next) => req.user?.role === 'superadmin'
  ? next() : res.status(403).json({ message: 'No tenés permiso para acceder a la administración' })

export const requireStudent = (req, res, next) => req.user?.role === 'student'
  ? next() : res.status(403).json({ message: 'Esta operación está disponible únicamente para estudiantes' })
