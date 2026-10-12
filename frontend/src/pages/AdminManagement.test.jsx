import { useState } from 'react'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../context/auth-context.js'
import { AppContext } from '../context/app-context.js'
import { AppProvider } from '../context/AppContext.jsx'
import { AdminLayout } from '../layouts/AdminLayout.jsx'
import { StudentRoute } from '../routes/StudentRoute.jsx'
import { AdminUsersPage } from './AdminUsersPage.jsx'
import { AdminSubjectsPage, AdminSystemPage } from './AdminInformationPage.jsx'
import { NotificationsPage } from './NotificationsPage.jsx'
import { LoginPage } from './LoginPage.jsx'
import * as admin from '../services/admin.service.js'
import { getProfile } from '../services/profiles.service.js'
vi.mock('../services/admin.service.js', () => ({ getAdminUsers: vi.fn(), getAdminUser: vi.fn(), updateAdminUserStatus: vi.fn(), deleteAdminUser: vi.fn(), getAdminSubjects: vi.fn(), getAdminSystem: vi.fn() }))
vi.mock('../services/profiles.service.js', () => ({ getProfile: vi.fn() }))
const account = { id: 7, email: 'student@example.test', username: 'Alumno', role: 'student', status: 'active', createdAt: '2026-10-12T00:00:00Z' }
beforeEach(() => {
  vi.clearAllMocks()
  admin.getAdminUsers.mockResolvedValue({ users: [account], page: 1, limit: 20, total: 21, totalPages: 2 })
  admin.getAdminUser.mockResolvedValue({ user: account, totals: { subjects: 2, teachers: 1 }, events: [], activity_note: 'Sin historial de visitas' })
  admin.updateAdminUserStatus.mockResolvedValue({ id: 7, status: 'suspended' })
  admin.deleteAdminUser.mockResolvedValue(null)
})
const users = () => render(<MemoryRouter><AuthContext.Provider value={{ user: { id: 8, role: 'superadmin' } }}><AdminUsersPage /></AuthContext.Provider></MemoryRouter>)
it('separa el layout administrativo, evita cargas académicas y redirige accesos de superadmin', async () => {
  const signOut = vi.fn()
  render(<MemoryRouter initialEntries={['/tasks']}><AuthContext.Provider value={{ user: { id: 8, role: 'superadmin' }, signOut }}><AppProvider><Routes>
    <Route element={<StudentRoute />}><Route path="tasks" element={<h1>Tareas académicas</h1>} /></Route>
    <Route element={<AdminLayout />}><Route path="admin" element={<h1>Panel administrativo</h1>} /></Route>
  </Routes></AppProvider></AuthContext.Provider></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'Panel administrativo' })).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Administración' })).toHaveTextContent('ResumenUsuariosMateriasSistema')
  expect(screen.queryByRole('link', { name: 'Perfil' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Tareas académicas' })).not.toBeInTheDocument()
  expect(getProfile).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
  expect(signOut).toHaveBeenCalledOnce()
})
it('consulta usuarios y pagina usando el servicio', async () => {
  users()
  expect(await screen.findByText('student@example.test')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  await waitFor(() => expect(admin.getAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 20 })))
  await userEvent.selectOptions(screen.getByLabelText('Estado'), 'suspended')
  await waitFor(() => expect(admin.getAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, status: 'suspended' })))
})
it('confirma suspensión con motivo y muestra el resultado real', async () => {
  users()
  await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }))
  const modal = screen.getByRole('dialog')
  expect(admin.updateAdminUserStatus).not.toHaveBeenCalled()
  await userEvent.type(within(modal).getByLabelText('Motivo (opcional)'), 'Revisión')
  await userEvent.click(within(modal).getByRole('button', { name: 'Confirmar' }))
  expect(admin.updateAdminUserStatus).toHaveBeenCalledWith(7, { status: 'suspended', reason: 'Revisión', confirmation: 'CONFIRMAR' })
  expect(await screen.findByRole('status')).toHaveTextContent('El estado de la cuenta fue actualizado')
})
it('exige confirmación reforzada y contraseña; mantiene errores de eliminación en el modal', async () => {
  admin.deleteAdminUser.mockRejectedValueOnce(new Error('La contraseña actual no es correcta'))
  users()
  await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }))
  const modal = screen.getByRole('dialog')
  expect(modal).toHaveTextContent('irreversible')
  await userEvent.type(within(modal).getByLabelText('Escribí ELIMINAR'), 'ELIMINAR')
  await userEvent.type(within(modal).getByLabelText('Tu contraseña de superadministrador'), 'admin-password')
  await userEvent.click(within(modal).getByRole('button', { name: 'Confirmar' }))
  expect(admin.deleteAdminUser).toHaveBeenCalledWith(7, { password: 'admin-password', confirmation: 'ELIMINAR' })
  expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña actual no es correcta')
  expect(within(modal).getByLabelText('Tu contraseña de superadministrador')).toHaveValue('')
})
it('deshabilita acciones sobre la propia cuenta', async () => {
  admin.getAdminUsers.mockResolvedValue({ users: [{ ...account, id: 8, role: 'superadmin' }], page: 1, total: 1, totalPages: 1 })
  users()
  expect(await screen.findByRole('button', { name: 'Suspender' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled()
})
it('presenta materias agrupadas con nombres originales y búsqueda', async () => {
  admin.getAdminSubjects.mockResolvedValue({ total: 1, totalUnique: 1, totalRegistrations: 3, page: 1, totalPages: 1, topSubjects: [], subjects: [{ key: 'matematica', name: 'Matemática', frequency: 3, variant_count: 2, variants: ['Matemática', 'MATEMATICA'] }] })
  render(<AdminSubjectsPage />)
  expect(await screen.findByText('1 materias únicas · 3 registros')).toBeInTheDocument()
  expect(screen.getByRole('table')).toHaveTextContent('MATEMATICA')
  await userEvent.type(screen.getByLabelText('Buscar materia'), 'mate')
  await waitFor(() => expect(admin.getAdminSubjects).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'mate' })))
})
it('muestra indicadores de sistema y limitaciones sin información sensible', async () => {
  admin.getAdminSystem.mockResolvedValue({ api: 'ok', database: 'ok', application_version: 'Beta 0.1', generated_at: '2026-10-12T00:00:00Z', notifications: { enabled: false, pending: 4, sent: 2, failed: 1, note: 'No confirma lectura.' } })
  render(<AdminSystemPage />)
  expect(await screen.findByText('Conectado')).toBeInTheDocument()
  expect(screen.getByText('Deshabilitado')).toBeInTheDocument()
  expect(screen.getByText('No confirma lectura.')).toBeInTheDocument()
})
it('elimina todas solo después de confirmar y actualiza el contador', async () => {
  const remove = vi.fn().mockResolvedValue(true)
  const Harness = () => {
    const [notifications, setNotifications] = useState([{ id: 'key', message: 'Aviso', type: 'task', read: false }])
    return <MemoryRouter><AppContext.Provider value={{ data: { notifications }, notify: vi.fn(), refreshNotifications: vi.fn(), removeAllNotifications: async () => { await remove(); setNotifications([]); return true } }}><NotificationsPage /></AppContext.Provider></MemoryRouter>
  }
  render(<Harness />)
  await userEvent.click(screen.getByRole('button', { name: 'Eliminar todas' }))
  expect(remove).not.toHaveBeenCalled()
  const modal = screen.getByRole('dialog')
  expect(modal).toHaveTextContent('ni se cancelarán futuros recordatorios')
  await userEvent.click(within(modal).getByRole('button', { name: 'Eliminar' }))
  expect(await screen.findByText('0 notificaciones sin leer')).toBeInTheDocument()
  expect(screen.queryByText('Aviso')).not.toBeInTheDocument()
})
it('redirige el login administrativo sin alterar el formulario ni las animaciones', async () => {
  const signIn = vi.fn().mockResolvedValue({ role: 'superadmin' })
  render(<MemoryRouter initialEntries={['/login']}><AuthContext.Provider value={{ signIn }}><Routes><Route path="login" element={<LoginPage />} /><Route path="admin" element={<h1>Administración propia</h1>} /></Routes></AuthContext.Provider></MemoryRouter>)
  await userEvent.type(screen.getByLabelText('Email'), 'admin@example.test')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'password123')
  expect(screen.getByRole('button', { name: 'Ingresar' }).closest('form')).toHaveClass('login-form')
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
  expect(await screen.findByRole('heading', { name: 'Administración propia' })).toBeInTheDocument()
})
