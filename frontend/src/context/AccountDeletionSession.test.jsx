import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthContext.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { saveSession, getSession, clearSession } from '../utils/authSession.js'
import { cleanupPushAfterAccountDeletion } from '../services/pushNotifications.js'
import { login } from '../services/auth.service.js'
vi.mock('../services/pushNotifications.js', () => ({ cleanupPushOnLogout: vi.fn(), cleanupPushAfterAccountDeletion: vi.fn() }))
vi.mock('../services/auth.service.js', () => ({ login: vi.fn() }))
const Consumer = () => {
  const { user, signIn, completeAccountDeletion, sessionMessage } = useAuth()
  return <><p>{user?.email ?? sessionMessage}</p><button onClick={() => completeAccountDeletion(7)}>Completar baja</button><button onClick={() => signIn({})}>Nueva sesión</button></>
}
afterEach(() => { clearSession(); vi.clearAllMocks() })
it('limpia la sesión eliminada y muestra confirmación', async () => {
  saveSession({ user: { id: 7, email: 'old@example.test' }, token: 'old-token' })
  cleanupPushAfterAccountDeletion.mockResolvedValue(undefined)
  render(<AuthProvider><Consumer /></AuthProvider>)
  await userEvent.click(screen.getByRole('button', { name: 'Completar baja' }))
  expect(await screen.findByText('Tu cuenta fue eliminada correctamente.')).toBeInTheDocument()
  expect(getSession()).toBeNull()
})
it('una limpieza tardía no cierra una nueva sesión de otra cuenta', async () => {
  saveSession({ user: { id: 7, email: 'old@example.test' }, token: 'old-token' })
  let finish
  cleanupPushAfterAccountDeletion.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  login.mockResolvedValue({ user: { id: 8, email: 'new@example.test' }, token: 'new-token' })
  render(<AuthProvider><Consumer /></AuthProvider>)
  await userEvent.click(screen.getByRole('button', { name: 'Completar baja' }))
  await userEvent.click(screen.getByRole('button', { name: 'Nueva sesión' }))
  await screen.findByText('new@example.test')
  await act(async () => finish())
  expect(getSession()?.token).toBe('new-token')
  expect(screen.getByText('new@example.test')).toBeInTheDocument()
})
