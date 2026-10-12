import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../context/auth-context.js'
import { AdminRoute } from '../routes/AdminRoute.jsx'
import { Sidebar } from '../components/common/Sidebar.jsx'
import { AdminDashboardPage } from './AdminDashboardPage.jsx'
import { getAdminStatistics } from '../services/admin.service.js'
vi.mock('../services/admin.service.js', () => ({ getAdminStatistics: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
it.each(['student', undefined])('no muestra acceso administrativo ni admite la ruta con rol %s', async role => {
  render(<MemoryRouter initialEntries={['/admin']}><AuthContext.Provider value={{ user: { id: 7, role } }}><Sidebar /><Routes><Route path="/" element={<h1>Académico</h1>} /><Route element={<AdminRoute />}><Route path="admin" element={<AdminDashboardPage />} /></Route></Routes></AuthContext.Provider></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'Académico' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Administración' })).not.toBeInTheDocument()
  expect(getAdminStatistics).not.toHaveBeenCalled()
})
it('muestra agregados y gráfico accesible solo para el superadministrador', async () => {
  getAdminStatistics.mockResolvedValue({ totals: { users: 20, subjects: 30, tasks: 50, exams: 12 }, registrations_last_7_days: 4, active_users_last_7_days: 8, activity_definition: 'Cambios académicos; no mide visitas.', registration_history: [{ day: '2026-10-12', count: 4 }] })
  render(<MemoryRouter><AuthContext.Provider value={{ user: { role: 'superadmin' } }}><Sidebar /><AdminDashboardPage /></AuthContext.Provider></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'Uso de Fokus' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Administración' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: /Registros diarios/ })).toBeInTheDocument()
  expect(screen.getByRole('table')).toHaveTextContent('2026-10-12')
  expect(screen.getByText('Cambios académicos; no mide visitas.')).toBeInTheDocument()
})
