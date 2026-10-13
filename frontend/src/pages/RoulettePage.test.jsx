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
const initialData = () => ({ profile: { name: 'Estudiante' }, teachers: [], subjects: [{ id: 1, name: 'Programación II' }, { id: 2, name: 'Matemática' }, { id: 4, name: 'Historia' }], tasks: [{ id: 2, title: 'Entrega de práctica', status: 'pending', subject_id: 1 }, { id: 3, title: 'Tarea terminada', status: 'completed', subject_id: 1 }], exams: [{ id: 4, title: 'Parcial', subject_id: 1, exam_date: '2026-11-01' }], notes: [], activities: [], notifications: [] })
let data, context
const Location = () => { const location = useLocation(); return <p data-testid="location">{location.pathname}{location.hash}</p> }
const tree = (routes = false, value = context, userId = 7) => <MemoryRouter initialEntries={['/roulette']}><AuthContext.Provider value={{ user: { id: userId, role: 'student' } }}><AppContext.Provider value={value}>{routes ? <AppRoutes /> : <RoulettePage />}<Location /></AppContext.Provider></AuthContext.Provider></MemoryRouter>
const mount = (routes = false) => render(tree(routes))
const complete = () => act(() => vi.advanceTimersByTime(4700))
beforeEach(() => {
  localStorage.clear(); vi.useFakeTimers(); randomIndex.mockReturnValue(1)
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
  vi.stubGlobal('scrollTo', vi.fn())
  data = initialData(); context = { data, isLoading: false, addItem: vi.fn(), updateItem: vi.fn(), removeItem: vi.fn(), notify: vi.fn() }
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.restoreAllMocks() })
describe('Ruleta del estudiante', () => {
  it('incluye una materia nueva incluso después de excluir todas y olvidar IDs eliminados', () => {
    const view = mount(); fireEvent.click(screen.getByRole('button', { name: 'Quitar todas' }))
    data.subjects = [...data.subjects.filter(subject => subject.id !== 2), { id: 9, name: 'Física' }]
    view.rerender(tree(false, { ...context, data: { ...data } }))
    expect(screen.getByLabelText(/Física/)).toBeChecked(); expect(screen.getByRole('button', { name: 'Girar ruleta' })).toBeEnabled()
    expect(JSON.parse(localStorage.getItem('fokus:roulette-excluded:7'))).toEqual([1, 4])
    data.subjects = [...data.subjects, { id: 2, name: 'Matemática recuperada' }]
    view.rerender(tree(false, { ...context, data: { ...data } }))
    expect(screen.getByLabelText(/Matemática recuperada/)).toBeChecked()
  })
  it('recupera exclusiones entre cargas e incluye materias nuevas automáticamente', () => {
    const view = mount(); fireEvent.click(screen.getByLabelText(/Matemática/))
    expect(JSON.parse(localStorage.getItem('fokus:roulette-excluded:7'))).toEqual([2])
    view.unmount(); data.subjects.push({ id: 9, name: 'Física' }); mount()
    expect(screen.getByLabelText(/Matemática/)).not.toBeChecked()
    expect(screen.getByLabelText(/Física/)).toBeChecked()
    expect(screen.getByLabelText(/Programación II/)).toBeChecked()
  })
  it('limpia exclusiones de materias eliminadas sin guardar participantes', () => {
    localStorage.setItem('fokus:roulette-excluded:7', '[2,99]')
    const view = mount(); expect(JSON.parse(localStorage.getItem('fokus:roulette-excluded:7'))).toEqual([2])
    data.subjects = data.subjects.filter(subject => subject.id !== 2)
    view.rerender(tree(false, { ...context, data: { ...data } }))
    expect(screen.queryByLabelText(/Matemática/)).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('fokus:roulette-excluded:7'))).toEqual([])
  })
  it('no borra exclusiones antes de terminar la carga o cuando esta falla', () => {
    localStorage.setItem('fokus:roulette-excluded:7', '[2]')
    const view = render(tree(false, { ...context, data: { ...data, subjects: [] }, isLoading: true }))
    expect(JSON.parse(localStorage.getItem('fokus:roulette-excluded:7'))).toEqual([2])
    view.rerender(tree(false, { ...context, data: { ...data, subjects: [] }, isLoading: false, error: 'No hay conexión' }))
    expect(JSON.parse(localStorage.getItem('fokus:roulette-excluded:7'))).toEqual([2])
    view.rerender(tree()); expect(screen.getByLabelText(/Matemática/)).not.toBeChecked()
  })
  it('separa exclusiones por cuenta y cancela un giro al cambiar usuario', () => {
    const view = mount(); fireEvent.click(screen.getByLabelText(/Programación II/))
    fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }))
    view.rerender(tree(false, context, 8))
    expect(screen.getByLabelText(/Programación II/)).toBeChecked()
    expect(screen.queryByRole('heading', { name: 'Historia' })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('fokus:roulette-excluded:7'))).toEqual([1])
    expect(JSON.parse(localStorage.getItem('fokus:roulette-excluded:8'))).toEqual([])
    complete(); expect(screen.queryByRole('link', { name: 'Ir a la materia' })).not.toBeInTheDocument()
  })
  it('no duplica una materia recibida más de una vez y tolera almacenamiento bloqueado', () => {
    data.subjects.push({ id: 2, name: 'Matemática' })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota') })
    mount(); expect(screen.getAllByLabelText(/Matemática/)).toHaveLength(1)
    fireEvent.click(screen.getByLabelText(/Matemática/)); expect(screen.getByLabelText(/Matemática/)).not.toBeChecked()
    expect(screen.getByText(/No pudimos guardar tus exclusiones/)).toBeInTheDocument()
  })
  it('carga todas las materias y permite excluir sin tareas ni exámenes', () => {
    mount()
    expect(screen.queryByLabelText(/Tarea terminada/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Entrega de práctica/)).not.toBeInTheDocument(); expect(screen.queryByLabelText(/Parcial/)).not.toBeInTheDocument(); expect(screen.getByLabelText(/Programación II/)).toBeChecked()
    fireEvent.click(screen.getByLabelText(/Programación II/))
    fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }))
    expect(randomIndex).toHaveBeenCalledWith(2)
    complete()
    expect(screen.getByRole('heading', { name: 'Historia' })).toBeInTheDocument()
    expect(context.updateItem).not.toHaveBeenCalled(); expect(context.addItem).not.toHaveBeenCalled(); expect(context.removeItem).not.toHaveBeenCalled()
  })
  it('dura 4,6 segundos, bloquea giros/cambios y coincide con la flecha al finalizar', () => {
    const view = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }))
    expect(screen.getByRole('button', { name: 'Girando…' })).toBeDisabled()
    expect(screen.getByLabelText(/Matemática/)).toBeDisabled()
    expect(screen.queryByLabelText('Incluir también tareas completadas')).not.toBeInTheDocument()
    const disc = view.container.querySelector('.roulette-disc')
    expect(disc.style.transitionDuration).toBe('4600ms')
    expect(disc.style.transform).toBe('rotate(2340deg)') // Sector 2 de 3: centro 180°.
    act(() => vi.advanceTimersByTime(4500))
    expect(screen.queryByRole('link', { name: 'Ir a la materia' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Girando…' }))
    expect(randomIndex).toHaveBeenCalledOnce()
    const event = new Event('transitionend', { bubbles: true }); Object.defineProperty(event, 'propertyName', { value: 'transform' })
    act(() => vi.advanceTimersByTime(100)); fireEvent(disc, event)
    expect(screen.getByRole('heading', { name: 'Matemática' })).toBeInTheDocument()
    complete(); expect(randomIndex).toHaveBeenCalledOnce()
  })
  it('muestra vacío y giro deshabilitado aunque existan tareas o exámenes', () => {
    data.subjects = []; data.tasks = [{ id: 3, title: 'Tarea terminada', status: 'completed' }]; data.exams = []
    mount()
    expect(screen.getByRole('heading', { name: 'Tu ruleta está esperando materias' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Girar ruleta' })).toBeDisabled()
    expect(screen.queryByLabelText('Incluir también tareas completadas')).not.toBeInTheDocument()
    expect(data.tasks[0].status).toBe('completed')
  })
  it('deshabilita una ruleta sin selecciones y permite volver a seleccionar todas', () => {
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Quitar todas' }))
    expect(screen.getByRole('button', { name: 'Girar ruleta' })).toBeDisabled()
    expect(screen.getByRole('heading', { name: 'Elegí al menos una materia' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar todas' }))
    expect(screen.getByRole('button', { name: 'Girar ruleta' })).toBeEnabled()
  })
  it('respeta movimiento reducido y sigue mostrando un resultado justo', () => {
    matchMedia.mockReturnValue({ matches: true })
    const view = mount(); fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }))
    expect(screen.getByRole('link', { name: 'Ir a la materia' })).toHaveAttribute('href', '/subjects#subject-2')
    expect(view.container.querySelector('.roulette-disc').style.transitionDuration).toBe('0ms')
    expect(screen.getByRole('button', { name: 'Girar ruleta' })).toBeEnabled()
  })
  it('silencia comentarios sin ocultar la actividad seleccionada', () => {
    mount(); fireEvent.click(screen.getByLabelText('Comentarios de la ruleta'))
    fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' })); complete()
    expect(screen.queryByText(/Mis condolencias/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Matemática' })).toBeInTheDocument()
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
    data.subjects = data.subjects.filter(subject => subject.id !== 2)
    view.rerender(tree(false, { ...context, data: { ...data } }))
    expect(view.container.querySelectorAll('.roulette-disc svg g')).toHaveLength(3)
    complete()
    expect(screen.getByText(/Esta materia ya no está disponible/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ir a la materia' })).not.toBeInTheDocument()
  })
  it('limpia el giro al salir de la página', () => {
    const view = mount(); fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }))
    view.unmount(); complete()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('integra menú/ruta y permite ir a la tarjeta de la materia ganadora', () => {
    mount(true)
    expect(screen.getByRole('link', { name: 'Ruleta' })).toHaveAttribute('href', '/roulette')
    fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' })); complete()
    fireEvent.click(screen.getByRole('link', { name: 'Ir a la materia' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/subjects#subject-2')
    act(() => vi.advanceTimersByTime(100))
    expect(document.activeElement).toBe(document.getElementById('subject-2'))
    expect(context.updateItem).not.toHaveBeenCalled()
  })
})
