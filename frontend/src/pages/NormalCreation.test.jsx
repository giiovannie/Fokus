import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { AppContext } from '../context/app-context.js'
import { TasksPage } from './TasksPage.jsx'
import { ExamsPage } from './ExamsPage.jsx'
import { SubjectsPage } from './SubjectsPage.jsx'
let data, addItem, updateItem
const mount = Component => render(<AppContext.Provider value={{ data, addItem, updateItem, removeItem: vi.fn(), notify: vi.fn() }}><Component /></AppContext.Provider>)
beforeEach(() => {
  data = { profile: { name: 'Ana' }, teachers: [{ id: 3, name: 'Profesora' }], subjects: [{ id: 2, name: 'Historia', teacher_id: 3 }], tasks: [], exams: [], notes: [] }
  addItem = vi.fn().mockResolvedValue(true); updateItem = vi.fn().mockResolvedValue(true)
})
afterEach(() => vi.clearAllMocks())
it.each([[TasksPage, 'tarea', 'tasks'], [ExamsPage, 'examen', 'exams']])('conserva formulario normal de %s sin creación anidada', async (Page, label, collection) => {
  mount(Page); fireEvent.click(screen.getByRole('button', { name: 'Crear ' + label }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Actividad real' } })
  fireEvent.change(screen.getByLabelText('Materia *'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText(label === 'tarea' ? 'Fecha de entrega' : 'Fecha *'), { target: { value: '2026-11-10' } })
  expect(screen.queryByRole('button', { name: 'Crear materia aquí' })).not.toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Crear ' + label }))
  await waitFor(() => expect(addItem).toHaveBeenCalledWith(collection, expect.objectContaining({ title: 'Actividad real', subject_id: 2 })))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
it('orienta sin crear materia ni profesor automáticamente cuando faltan', () => {
  data.subjects = []; mount(ExamsPage); fireEvent.click(screen.getByRole('button', { name: 'Crear examen' }))
  expect(screen.getByText('Primero creá una materia en la sección Materias.')).toBeInTheDocument()
  expect(addItem).not.toHaveBeenCalled(); expect(screen.getAllByRole('dialog')).toHaveLength(1)
})
it('mantiene el borrador normal si falla el guardado', async () => {
  addItem.mockResolvedValue(false); mount(TasksPage); fireEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))
  fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Borrador' } }); fireEvent.change(screen.getByLabelText('Materia *'), { target: { value: '2' } })
  fireEvent.click(screen.getByLabelText('Sin fecha de entrega'))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear tarea' }))
  await screen.findByRole('alert'); expect(screen.getByLabelText('Título *')).toHaveValue('Borrador')
})
it('conserva creación independiente de profesores y materias', async () => {
  const view = mount(SubjectsPage); fireEvent.click(screen.getByRole('button', { name: 'Agregar profesor' }))
  fireEvent.change(screen.getByLabelText('Nombre del profesor'), { target: { value: 'Nuevo profesor' } })
  fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
  await waitFor(() => expect(addItem).toHaveBeenCalledWith('teachers', { name: 'Nuevo profesor' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  view.unmount(); mount(SubjectsPage); fireEvent.click(screen.getByRole('button', { name: 'Crear materia' }))
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nueva materia' } }); fireEvent.change(screen.getByLabelText('Profesor'), { target: { value: '3' } })
  expect(screen.queryByRole('button', { name: 'Crear profesor aquí' })).not.toBeInTheDocument()
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear materia' }))
  await waitFor(() => expect(addItem).toHaveBeenCalledWith('subjects', { name: 'Nueva materia', teacher_id: 3 }))
})
it.each([true, false])('felicita solo después de confirmar una tarea completada (guardado=%s)', async saved => {
  data.tasks = [{ id: 1, title: 'Trabajo', status: 'pending', subject_id: 2, due_date: null }]
  updateItem.mockResolvedValue(saved); const { container } = mount(TasksPage)
  expect(container.querySelector('img[src*="graduado"]')).toBeNull()
  fireEvent.change(screen.getByLabelText('Estado de tarea'), { target: { value: 'completed' } })
  await waitFor(() => expect(updateItem).toHaveBeenCalledWith('tasks', 1, { status: 'completed' }))
  if (saved) expect(await screen.findByRole('status')).toHaveTextContent('¡Completaste «Trabajo»!')
  expect(Boolean(container.querySelector('img[src*="graduado"]'))).toBe(saved)
})
