import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { AppContext } from '../context/app-context.js'
import { AuthContext } from '../context/auth-context.js'
import { MainLayout } from './MainLayout.jsx'
import { ProfilePage } from '../pages/ProfilePage.jsx'
import { DashboardPage } from '../pages/DashboardPage.jsx'
vi.mock('../services/calendar.service.js', () => ({ CALENDAR_CHANGED_EVENT: 'fokus:calendar-changed', getCalendar: async () => ({ events: [], timezone: 'America/Argentina/Cordoba' }) }))
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
const mount = path => render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ user: { id: 7, role: 'student' } }}><AppContext.Provider value={{ data: { profile: { id: 2, name: 'Ana', nickname: 'Ani' }, subjects: [], tasks: [], exams: [], notifications: [], notes: [], teachers: [] }, isLoading: false, refreshNotifications: vi.fn() }}><Routes><Route element={<MainLayout />}><Route index element={<DashboardPage />} /><Route path="profile" element={<ProfilePage />} /></Route></Routes></AppContext.Provider></AuthContext.Provider></MemoryRouter>)
it.each(['/', '/profile'])('no monta recorrido, overlays ni opción de tutorial en %s', async path => {
  const { container } = mount(path)
  await waitFor(() => expect(screen.getByRole('heading', { name: path === '/' ? 'Buen día, Ana' : 'Tu perfil' })).toBeInTheDocument())
  fireEvent(window, new Event('fokus:open-tutorial'))
  expect(screen.queryByRole('button', { name: 'Ver tutorial' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Comenzar recorrido' })).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Tutorial de Fokus' })).not.toBeInTheDocument()
  expect(container.querySelector('.guided-tour-highlight')).toBeNull(); expect(fetch).not.toHaveBeenCalled()
})
