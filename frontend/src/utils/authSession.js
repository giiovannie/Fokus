const SESSION_KEY = 'task-organization-session'

export const getSession = () => {
  try {
    const session = JSON.parse(window.localStorage.getItem(SESSION_KEY))
    return session?.token && session?.user ? session : null
  } catch {
    return null
  }
}

export const saveSession = (session) => {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export const clearSession = () => {
  window.localStorage.removeItem(SESSION_KEY)
}

export const getAccessToken = () => getSession()?.token ?? null

export const SESSION_EXPIRED_EVENT = 'fokus:session-expired'
export const SESSION_EXPIRED_MESSAGE = 'Tu sesión expiró. Iniciá sesión nuevamente.'

// Una respuesta tardía de una sesión anterior no debe cerrar la nueva.
export const expireSession = (token) => {
  if (!token || getAccessToken() !== token) return false
  clearSession()
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  return true
}
