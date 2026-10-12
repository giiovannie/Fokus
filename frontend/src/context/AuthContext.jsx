import { useCallback, useEffect, useMemo, useState } from 'react'
import { cleanupPushOnLogout, cleanupPushAfterAccountDeletion } from '../services/pushNotifications.js'
import { login } from '../services/auth.service.js'
import { createUser } from '../services/users.service.js'
import { clearSession, getSession, saveSession, SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE } from '../utils/authSession.js'
import { AuthContext } from './auth-context.js'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getSession()?.user ?? null)
  const [sessionMessage, setSessionMessage] = useState('')
  useEffect(() => {
    const onExpired = () => { setUser(null); setSessionMessage(SESSION_EXPIRED_MESSAGE) }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  const signIn = useCallback(async (credentials) => {
    await cleanupPushOnLogout()
    const session = await login(credentials)
    setSessionMessage('')
    saveSession(session)
    setUser(session.user)
    return session.user
  }, [])

  const signUp = useCallback(async (credentials) => {
    await createUser(credentials)
    return signIn(credentials)
  }, [signIn])

  const signOut = useCallback(async () => {
    await cleanupPushOnLogout()
    setSessionMessage('')
    clearSession()
    setUser(null)
  }, [])

  const completeAccountDeletion = useCallback(async deletedUserId => {
    const stillOwnSession = () => !getSession() || getSession().user.id === deletedUserId
    if (!stillOwnSession()) return false
    await cleanupPushAfterAccountDeletion(deletedUserId)
    if (!stillOwnSession()) return false
    window.localStorage.removeItem('organiza:read-notifications:' + deletedUserId)
    clearSession(); setUser(null); setSessionMessage('Tu cuenta fue eliminada correctamente.')
    return true
  }, [])

  const value = useMemo(() => ({ user, sessionMessage, signIn, signUp, signOut, completeAccountDeletion }), [user, sessionMessage, signIn, signUp, signOut, completeAccountDeletion])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
