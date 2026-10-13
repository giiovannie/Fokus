import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../context/auth-context.js'
import { AppContext } from '../context/app-context.js'
import { CalendarPage } from './CalendarPage.jsx'
import { UpcomingAgenda } from '../components/common/UpcomingAgenda.jsx'
import { getCalendar, saveAgendaEvent, deleteAgendaEvent } from '../services/calendar.service.js'
vi.mock('../services/calendar.service.js', () => ({ CALENDAR_CHANGED_EVENT: 'fokus:calendar-changed', getCalendar: vi.fn(), saveAgendaEvent: vi.fn(), deleteAgendaEvent: vi.fn() }))
let events
const custom = overrides => ({ id: 4, key: 'agenda:4', type: 'personal', kind: 'personal', title: 'Cita', date: '2026-10-13', event_date: '2026-10-13', time: null, event_time: null, subject_id: null, reminder_minutes: null, description: 'Llevar apuntes', ...overrides })
const tree = (component = <CalendarPage />, id = 7, path = '/calendar?date=2026-10-13') => <MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ user: { id, role: 'student' } }}><AppContext.Provider value={{ data: { subjects: [{ id: 2, name: 'Historia' }] } }}>{component}</AppContext.Provider></AuthContext.Provider></MemoryRouter>
const mount = () => render(tree())
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime('2026-10-13T12:00:00Z')
  events = [custom()]
  getCalendar.mockImplementation(async () => ({ events, timezone: 'America/Argentina/Cordoba', truncated: false }))
  saveAgendaEvent.mockResolvedValue({ id: 5 }); deleteAgendaEvent.mockResolvedValue(null)
})
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers() })
it('muestra cuatro indicadores coincidentes y usa las rutas reales de origen', async () => {
  events.push({ key: 'exam:1', id: 1, type: 'exam', title: 'Parcial', date: '2026-10-13', time: '10:00', subject: 'Historia', href: '/exams#exam-1' }, { key: 'task:2', id: 2, type: 'task', title: 'Entrega', date: '2026-10-13', time: null, href: '/tasks#task-2' }, custom({ key: 'agenda:8', id: 8, type: 'academic', kind: 'academic', title: 'Charla' }))
  mount(); await screen.findByRole('button', { name: /Parcial.*Examen/ })
  const day = screen.getByRole('button', { name: '13 de octubre de 2026, 4 actividades' })
  expect(day).toHaveAttribute('aria-current', 'date'); expect(day).toHaveAttribute('aria-pressed', 'true')
  for (const label of ['1 Examen', '1 Tarea', '1 Personal', '1 Académico']) expect(within(day).getByLabelText(label)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Parcial.*Examen/ }))
  expect(screen.getByRole('link', { name: 'Abrir examen' })).toHaveAttribute('href', '/exams#exam-1')
  expect(saveAgendaEvent).not.toHaveBeenCalled()
})
it('consulta solamente los rangos visibles y navega entre mes, semana y hoy', async () => {
  mount(); await screen.findByRole('button', { name: /Cita.*Personal/ })
  expect(getCalendar).toHaveBeenCalledWith('2026-09-28', '2026-11-08', false, expect.any(AbortSignal))
  fireEvent.change(screen.getByLabelText('Vista del calendario'), { target: { value: 'week' } })
  await waitFor(() => expect(getCalendar).toHaveBeenLastCalledWith('2026-10-12', '2026-10-18', false, expect.any(AbortSignal)))
  fireEvent.click(screen.getByLabelText('Período siguiente'))
  await waitFor(() => expect(getCalendar).toHaveBeenLastCalledWith('2026-10-19', '2026-10-25', false, expect.any(AbortSignal)))
  fireEvent.click(screen.getByRole('button', { name: 'Hoy' }))
  await waitFor(() => expect(getCalendar).toHaveBeenLastCalledWith('2026-10-12', '2026-10-18', false, expect.any(AbortSignal)))
})
it('guarda día completo por la API sin hora ni aviso y recarga tras guardar', async () => {
  mount(); await screen.findByRole('button', { name: /Cita.*Personal/ })
  fireEvent.click(screen.getByRole('button', { name: 'Nueva actividad' }))
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Reunión' } })
  expect(screen.getByLabelText('Recordatorio')).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar actividad' }))
  await waitFor(() => expect(saveAgendaEvent).toHaveBeenCalledWith({ title: 'Reunión', description: '', kind: 'personal', event_date: '2026-10-13', event_time: null, subject_id: null, reminder_minutes: null }, null))
  await screen.findByText('Actividad creada.'); expect(getCalendar).toHaveBeenCalledTimes(2)
})
it('crea un evento académico con materia, horario y aviso; no escribe sin confirmar', async () => {
  mount(); await screen.findByRole('button', { name: /Cita.*Personal/ })
  fireEvent.click(screen.getByRole('button', { name: 'Nueva actividad' }))
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Consulta' } })
  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'academic' } })
  fireEvent.change(screen.getByLabelText('Materia (opcional)'), { target: { value: '2' } })
  fireEvent.click(screen.getByLabelText('Todo el día'))
  fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '18:00' } })
  fireEvent.change(screen.getByLabelText('Recordatorio'), { target: { value: '60' } })
  expect(saveAgendaEvent).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar actividad' }))
  await waitFor(() => expect(saveAgendaEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: 'academic', subject_id: 2, event_time: '18:00', reminder_minutes: 60 }), null))
})
it('edita usando el formulario original y conserva datos ante un fallo', async () => {
  saveAgendaEvent.mockRejectedValueOnce(new Error('Temporalmente ocupado'))
  mount(); fireEvent.click(await screen.findByRole('button', { name: /Cita.*Personal/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Editar actividad' }))
  expect(screen.getByLabelText('Descripción')).toHaveValue('Llevar apuntes')
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Cita nueva' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar actividad' }))
  await screen.findByRole('alert'); expect(screen.getByLabelText('Título')).toHaveValue('Cita nueva')
  expect(saveAgendaEvent).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cita nueva', event_time: null }), 4)
})
it('elimina únicamente después de una confirmación y permite cancelar', async () => {
  mount(); fireEvent.click(await screen.findByRole('button', { name: /Cita.*Personal/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar actividad' }))
  expect(deleteAgendaEvent).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(deleteAgendaEvent).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /Cita.*Personal/ })); fireEvent.click(screen.getByRole('button', { name: 'Eliminar actividad' })); fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
  await waitFor(() => expect(deleteAgendaEvent).toHaveBeenCalledWith(4)); await screen.findByText('Actividad eliminada.')
})
it('muestra vacío, error recuperable y límite comunicado sin polling', async () => {
  events = []; getCalendar.mockRejectedValueOnce(new Error('No hay conexión'))
  mount(); await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await screen.findByText('No hay actividades para este día.'); expect(getCalendar).toHaveBeenCalledTimes(2)
})
it('no permite que una respuesta anterior aparezca tras cambiar de cuenta', async () => {
  let resolve
  getCalendar.mockImplementationOnce(() => new Promise(done => { resolve = done })).mockResolvedValueOnce({ events: [], timezone: 'America/Argentina/Cordoba' })
  const view = mount(); view.rerender(tree(<CalendarPage />, 9))
  await screen.findByText('No hay actividades para este día.')
  resolve({ events: [custom()], timezone: 'America/Argentina/Cordoba' })
  await waitFor(() => expect(screen.queryByRole('button', { name: /Cita.*Personal/ })).not.toBeInTheDocument())
})
it('usa la zona guardada para el primer día seleccionado cercano a medianoche', async () => {
  vi.setSystemTime('2026-10-13T02:30:00Z')
  getCalendar.mockResolvedValue({ events: [], timezone: 'Europe/Madrid' })
  render(tree(<CalendarPage />, 7, '/calendar'))
  await waitFor(() => expect(screen.getByRole('button', { name: '13 de octubre de 2026, 0 actividades' })).toHaveAttribute('aria-pressed', 'true'))
})
it('abre una actividad desde el Dashboard y no duplica exámenes ni tareas', async () => {
  events.push({ key: 'exam:1', type: 'exam', title: 'Examen separado', date: '2026-10-14' }, custom({ id: 9, key: 'agenda:9', title: 'Pasada', date: '2026-10-12' }))
  render(tree(<UpcomingAgenda />))
  expect(await screen.findByRole('link', { name: /Cita/ })).toHaveAttribute('href', '/calendar?date=2026-10-13&event=4')
  expect(screen.queryByText('Examen separado')).not.toBeInTheDocument(); expect(screen.queryByText('Pasada')).not.toBeInTheDocument()
  expect(getCalendar.mock.calls[0][2]).toBe(true)
})
