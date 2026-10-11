import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { AppRoutes } from '../routes/AppRoutes.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'
import { AppProvider } from '../context/AppContext.jsx'
import { clearSession, saveSession } from '../utils/authSession.js'

const user = { id: 7, email: 'onboarding@example.test' }
const profile = { id: 2, user_id: 7, name: 'Ana', last_name: 'Pérez', nickname: 'Ani', avatar_url: null }
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body })
const Location = () => <output aria-label="Ruta actual">{useLocation().pathname}</output>
const mount = ({ initial = '/register', create = () => response(profile, 201), existing = false } = {}) => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const fetchMock = vi.fn(async (url, options = {}) => {
    const path = String(url)
    if (path.endsWith('/auth/login')) return response({ user, token: 'test-only' })
    if (path.endsWith('/users') && options.method === 'POST') return response(user, 201)
    if (path.endsWith('/profiles') && options.method === 'POST') return create()
    if (path.endsWith('/profiles/2') && options.method === 'PUT') return response(profile)
    if (path.endsWith('/profiles/7')) return existing ? response(profile) : response({ message: 'Sin perfil' }, 404)
    return response([])
  })
  vi.stubGlobal('fetch', fetchMock)
  render(<MemoryRouter initialEntries={[initial]}><AuthProvider><AppProvider><AppRoutes /><Location /></AppProvider></AuthProvider></MemoryRouter>)
  return fetchMock
}
const register = async () => {
  const keyboard = userEvent.setup()
  await keyboard.type(screen.getByLabelText('Email'), user.email)
  await keyboard.type(screen.getByLabelText('Contraseña'), 'test-password')
  await keyboard.type(screen.getByLabelText('Repetir contraseña'), 'test-password')
  await keyboard.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  await screen.findByLabelText('Nombre')
  return keyboard
}
afterEach(() => {
  clearSession()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
it('registro → creación de perfil → Dashboard sólo tras confirmar el guardado', async () => {
  clearSession()
  let resolveCreate
  const pending = new Promise(resolve => { resolveCreate = resolve })
  const fetchMock = mount({ create: () => pending })
  const keyboard = await register()
  expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/profile')
  await keyboard.type(screen.getByLabelText('Nombre'), profile.name)
  await keyboard.type(screen.getByLabelText('Apellido'), profile.last_name)
  await keyboard.type(screen.getByLabelText('Apodo'), profile.nickname)
  await keyboard.click(screen.getByRole('button', { name: 'Guardar perfil' }))
  await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => String(url).endsWith('/profiles') && options.method === 'POST')).toBe(true))
  expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/profile')
  expect(screen.queryByRole('heading', { name: 'Buen día, Ana' })).not.toBeInTheDocument()
  await act(async () => resolveCreate(response(profile, 201)))
  expect(await screen.findByRole('heading', { name: 'Buen día, Ana' })).toBeInTheDocument()
  expect(screen.getByLabelText('Ruta actual').textContent).toBe('/')
  expect(screen.getByText('Hola, Ani')).toBeInTheDocument()
  await keyboard.click(screen.getByRole('link', { name: /Materias/ }))
  expect(await screen.findByRole('heading', { name: 'Materias' })).toBeInTheDocument()
  expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/subjects')
})
it('permanece en el formulario si falla y permite reintentar la creación', async () => {
  clearSession()
  let succeed = false
  mount({ create: () => succeed ? response(profile, 201) : response({ message: 'Nombre requerido' }, 400) })
  const keyboard = await register()
  await keyboard.click(screen.getByRole('button', { name: 'Guardar perfil' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar')
  expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/profile')
  succeed = true
  await keyboard.click(screen.getByRole('button', { name: 'Guardar perfil' }))
  expect(await screen.findByRole('heading', { name: 'Buen día, Ana' })).toBeInTheDocument()
})
it('editar un perfil existente conserva la página y la sesión', async () => {
  saveSession({ user, token: 'test-only' })
  mount({ initial: '/profile', existing: true })
  await screen.findByLabelText('Nombre')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }))
  expect((await screen.findAllByText('Perfil actualizado.')).length).toBeGreaterThan(0)
  expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/profile')
  expect(screen.getByLabelText('Nombre')).toHaveValue('Ana')
})
