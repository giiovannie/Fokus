import { expireSession, getAccessToken, SESSION_EXPIRED_MESSAGE } from '../utils/authSession.js'

export const API_URL = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const apiRequest = async (path, options = {}) => {
  const token = getAccessToken()
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const data = response.status === 204 ? null : await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login' && path !== '/users' && expireSession(token)) {
      throw new ApiError(SESSION_EXPIRED_MESSAGE, 401)
    }
    throw new ApiError(data?.message ?? 'No se pudo completar la solicitud.', response.status)
  }

  return data
}
