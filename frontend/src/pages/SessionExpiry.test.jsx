import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { expect, it, vi, afterEach } from 'vitest'
import { AppRoutes } from '../routes/AppRoutes.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'
import { AppProvider } from '../context/AppContext.jsx'
import { clearSession, getSession, saveSession } from '../utils/authSession.js'
import { apiRequest } from '../services/api.js'

const Location = () => <output aria-label="Ruta actual">{useLocation().pathname}</output>
const mount = fetchMock => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.stubGlobal('fetch', fetchMock)
  render(<MemoryRouter initialEntries={['/']}><AuthProvider><AppProvider><AppRoutes /><Location /></AppProvider></AuthProvider></MemoryRouter>)
}
afterEach(() => { clearSession(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('sale del área protegida al expirar y permite iniciar sesión de nuevo', async () => {
  saveSession({ user: { id: 7, email: 'student@example.test' }, token: 'expired' })
  mount(vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'El token no es válido o expiró' }) }))
  expect(await screen.findByText('Tu sesión expiró. Iniciá sesión nuevamente.')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/login'))
  expect(getSession()).toBeNull()
  expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled()
  expect(screen.queryByText('Preparando todo...')).not.toBeInTheDocument()
  vi.stubGlobal('fetch', vi.fn(async url => ({ ok: true, status: 200, json: async () => String(url).endsWith('/auth/login') ? { user: { id: 7, email: 'student@example.test' }, token: 'renewed' } : [] })))
  const keyboard = userEvent.setup()
  await keyboard.type(screen.getByLabelText('Email'), 'student@example.test')
  await keyboard.type(screen.getByLabelText('Contraseña'), 'password123')
  await keyboard.click(screen.getByRole('button', { name: 'Ingresar' }))
  await waitFor(() => expect(screen.getByLabelText('Ruta actual')).toHaveTextContent(/^\/$/))
  expect(getSession()?.token).toBe('renewed')
  expect(screen.queryByText('Tu sesión expiró. Iniciá sesión nuevamente.')).not.toBeInTheDocument()
})

it('muestra carga solo durante las solicitudes reales y reacciona a un 401 posterior', async () => {
  saveSession({ user: { id: 7, email: 'student@example.test' }, token: 'valid' })
  const pending = []
  mount(vi.fn(() => new Promise(resolve => pending.push(resolve))))
  expect(screen.getByText('Preparando todo...')).toBeInTheDocument()
  expect(screen.getByText('Preparando todo...').closest('[role="status"]')).toHaveAttribute('aria-live', 'polite')
  await waitFor(() => expect(pending).toHaveLength(7))
  await act(async () => pending.forEach(resolve => resolve({ ok: true, status: 200, json: async () => [] })))
  await waitFor(() => expect(screen.queryByText('Preparando todo...')).not.toBeInTheDocument())
  expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Token inválido' }) }))
  await act(async () => { await apiRequest('/tasks').catch(() => {}) })
  expect(await screen.findByText('Tu sesión expiró. Iniciá sesión nuevamente.')).toBeInTheDocument()
})
