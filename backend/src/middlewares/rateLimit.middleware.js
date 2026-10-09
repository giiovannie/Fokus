import { rateLimit } from 'express-rate-limit'

const createLimiter = (limit, windowMs) => rateLimit({
  limit, windowMs, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { message: 'Demasiadas solicitudes. Intentá nuevamente más tarde' },
})

export const loginLimiter = createLimiter(20, 15 * 60 * 1000)
export const registrationLimiter = createLimiter(10, 60 * 60 * 1000)
export const avatarLimiter = createLimiter(30, 15 * 60 * 1000)
