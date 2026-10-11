import { useCallback, useMemo, useState } from 'react'
import { cleanupPushOnLogout } from '../services/pushNotifications.js'
import { login } from '../services/auth.service.js'
import { createUser } from '../services/users.service.js'
import { clearSession, getSession, saveSession } from '../utils/authSession.js'
import { AuthContext } from './auth-context.js'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getSession()?.user ?? null)

  const signIn = useCallback(async (credentials) => {
    await cleanupPushOnLogout()
    const session = await login(credentials)
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
    clearSession()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, signIn, signUp, signOut }), [user, signIn, signUp, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
