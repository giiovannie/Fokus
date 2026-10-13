import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { AppContext } from '../context/app-context.js'
import { AuthContext } from '../context/auth-context.js'
import { RoulettePage } from './RoulettePage.jsx'
import { AppRoutes } from '../routes/AppRoutes.jsx'
import { randomIndex } from '../utils/roulette.js'
vi.mock('../utils/roulette.js', async original => {
  const actual = await original()
  return { ...actual, randomIndex: vi.fn(), nextRouletteComment: (phase, previous, activity) => actual.nextRouletteComment(phase, previous, activity, () => 0) }
})
const initialData = () => ({ profile: { name: 'Estudiante' }, teachers: [], subjects: [{ id: 1, name: 'Programación II' }], tasks: [{ id: 2, title: 'Entrega de práctica', status: 'pending', subject_id: 1 }, { id: 3, title: 'Tarea terminada', status: 'completed', subject_id: 1 }], exams: [{ id: 4, title: 'Parcial', subject_id: 1, exam_date: '2026-11-01' }], notes: [], activities: [], notifications: [] })
let data, context
const Location = () => { const location = useLocation(); return <p data-testid="location">{location.pathname}{location.hash}</p> }
const tree = (routes = false, value = context) => <MemoryRouter initialEntries={['/roulette']}><AuthContext.Provider value={{ user: { id: 7, role: 'student' } }}><AppContext.Provider value={value}>{routes ? <AppRoutes /> : <RoulettePage />}<Location /></AppContext.Provider></AuthContext.Provider></MemoryRouter>
const mount = (routes = false) => render(tree(routes))
const complete = () => act(() => vi.advanceTimersByTime(4700))
beforeEach(() => {
  vi.useFakeTimers(); randomIndex.mockReturnValue(1)
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
  vi.stubGlobal('scrollTo', vi.fn())
  data = initialData(); context = { data, isLoading: false, addItem: vi.fn(), updateItem: vi.fn(), removeItem: vi.fn(), notify: vi.fn() }
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks() })
describe('Ruleta del estudiante', () => {
  it('permite elegir participantes y omite completadas inicialmente', () => {
    mount()
    expect(screen.queryByLabelText(/Tarea terminada/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Entrega de práctica/)).toBeChecked()
    fireEvent.click(screen.getByLabelText(/Entrega de práctica/))
    fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }))
    expect(randomIndex).toHaveBeenCalledWith(2)
    complete()
    expect(screen.getByRole('heading', { name: 'Parcial' })).toBeInTheDocument()
    expect(context.updateItem).not.toHaveBeenCalled(); expect(context.addItem).not.toHaveBeenCalled(); expect(context.removeItem).not.toHaveBeenCalled()
  })
  it('dura 4,6 segundos, bloquea giros/cambios y coincide con la flecha al finalizar', () => {
    const view = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }))
    expect(screen.getByRole('button', { name: 'Girando…' })).toBeDisabled()
    expect(screen.getByLabelText(/Entrega de práctica/)).toBeDisabled()
    expect(screen.getByLabelText('Incluir también tareas completadas')).toBeDisabled()
    const disc = view.container.querySelector('.roulette-disc')
    expect(disc.style.transitionDuration).toBe('4600ms')
    expect(disc.style.transform).toBe('rotate(2340deg)') // Sector 2 de 3: centro 180°.
    act(() => vi.advanceTimersByTime(4500))
    expect(screen.queryByRole('link', { name: 'Ir a la actividad' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Girando…' }))
    expect(randomIndex).toHaveBeenCalledOnce()
    const event = new Event('transitionend', { bubbles: true }); Object.defineProperty(event, 'propertyName', { value: 'transform' })
    act(() => vi.advanceTimersByTime(100)); fireEvent(disc, event)
    expect(screen.getByRole('heading', { name: 'Entrega de práctica' })).toBeInTheDocument()
    complete(); expect(randomIndex).toHaveBeenCalledOnce()
  })
  it('muestra el vacío y permite incluir una tarea completada sin cambiarla', () => {
    data.subjects = []; data.tasks = [{ id: 3, title: 'Tarea terminada', status: 'completed' }]; data.exams = []
    mount()
    expect(screen.getByRole('heading', { name: 'Tu ruleta está esperando opciones' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Girar ruleta' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Incluir también tareas completadas'))
    expect(screen.getByLabelText(/Tarea terminada/)).toBeChecked()
    expect(data.tasks[0].status).toBe('completed')
  })
  it('deshabilita una ruleta sin selecciones y permite volver a seleccionar todas', () => {
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Quitar todas' }))
    expect(screen.getByRole('button', { name: 'Girar ruleta' })).toBeDisabled()
    expect(screen.getByRole('heading', { name: 'Elegí al menos una opción' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar todas' }))
    expect(screen.getByRole('button', { name: 'Girar ruleta' })).toBeEnabled()
  })
  it('respeta movimiento reducido y sigue mostrando un resultado justo', () => {
    matchMedia.mockReturnValue({ matches: true })
    const view = mount(); fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }))
    expect(screen.getByRole('link', { name: 'Ir a la actividad' })).toHaveAttribute('href', '/tasks#task-2')
    expect(view.container.querySelector('.roulette-disc').style.transitionDuration).toBe('0ms')
    expect(screen.getByRole('button', { name: 'Girar ruleta' })).toBeEnabled()
  })
  it('silencia comentarios sin ocultar la actividad seleccionada', () => {
    mount(); fireEvent.click(screen.getByLabelText('Comentarios de la ruleta'))
    fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' })); complete()
    expect(screen.queryByText(/Mis condolencias/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Entrega de práctica' })).toBeInTheDocument()
  })
  it('comenta giros repetidos, conserva rotación y no repite frases de resultado', () => {
    const view = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' })); complete()
    const first = view.container.querySelector('.roulette-comment').textContent
    fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' })); complete()
    expect(view.container.querySelector('.roulette-comment').textContent).not.toBe(first)
    fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }))
    expect(screen.getByText('¿Cuántas veces vas a girar hasta que salga lo que querés?')).toBeInTheDocument()
    expect(view.container.querySelector('.roulette-disc').style.transform).toBe('rotate(6660deg)')
  })
  it('congela las opciones durante el giro y no enlaza una actividad que desapareció', () => {
    const view = mount(); fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }))
    data.tasks = []
    view.rerender(tree(false, { ...context, data: { ...data } }))
    expect(view.container.querySelectorAll('.roulette-disc svg g')).toHaveLength(3)
    complete()
    expect(screen.getByText(/Esta actividad ya no está disponible/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ir a la actividad' })).not.toBeInTheDocument()
  })
  it('limpia el giro al salir de la página', () => {
    const view = mount(); fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }))
    view.unmount(); complete()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('integra menú/ruta y permite ir a la tarjeta de la tarea ganadora', () => {
    mount(true)
    expect(screen.getByRole('link', { name: 'Ruleta' })).toHaveAttribute('href', '/roulette')
    fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' })); complete()
    fireEvent.click(screen.getByRole('link', { name: 'Ir a la actividad' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/tasks#task-2')
    act(() => vi.advanceTimersByTime(100))
    expect(document.activeElement).toBe(document.getElementById('task-2'))
    expect(context.updateItem).not.toHaveBeenCalled()
  })
})
