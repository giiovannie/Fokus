import { useState } from 'react'
import { render, screen, within, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { AppContext } from '../context/app-context.js'
import { SubjectsPage } from './SubjectsPage.jsx'
import { ExamsPage } from './ExamsPage.jsx'
import { TasksPage } from './TasksPage.jsx'
import { formatDate, daysRemaining, urgencyClass } from '../utils/date.js'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete HTMLDialogElement.prototype.showModal; delete HTMLDialogElement.prototype.close })
const Harness = ({ Page, save }) => {
  const [data, setData] = useState({ subjects: [{ id: 1, name: 'Matemática', teacher_id: 1 }], teachers: [{ id: 1, name: 'Ana' }], tasks: [], exams: [], notes: [] })
  const addItem = async (collection, values) => {
    if (!await save(collection, values)) return false
    setData(current => ({ ...current, [collection]: [...current[collection], { id: 2, ...values }] }))
    return true
  }
  return <AppContext.Provider value={{ data, addItem, notify: vi.fn(), updateItem: vi.fn(), removeItem: vi.fn() }}><Page /></AppContext.Provider>
}
const scenarios = [
  [SubjectsPage, 'Crear materia', 'Nombre', 'subject-teacher', 'subjects'],
  [ExamsPage, 'Crear examen', 'Título *', 'exam-subject', 'exams'],
  [TasksPage, 'Crear tarea', 'Título *', 'task-subject', 'tasks'],
  [SubjectsPage, 'Agregar profesor', 'Nombre del profesor', null, 'teachers'],
]
it.each(scenarios)('crea con modal %# y mantiene el formulario ante error', async (Page, label, field, select, collection) => {
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
  const user = userEvent.setup()
  render(<Harness Page={Page} save={save} />)
  const trigger = screen.getByRole('button', { name: label })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await user.click(trigger)
  const dialog = screen.getByRole('dialog', { name: label })
  const footer = dialog.querySelector('.modal-footer')
  expect(within(footer).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  const action = within(footer).getByRole('button', { name: collection === 'teachers' ? 'Agregar' : label })
  expect(action.form).toBe(dialog.querySelector('form'))
  expect(within(dialog).getAllByRole('heading')).toHaveLength(1)
  expect(within(dialog).getByLabelText(field)).toHaveFocus()
  await user.type(within(dialog).getByLabelText(field), 'Prueba')
  if (select) fireEvent.change(document.getElementById(select), { target: { value: '1' } })
  if (collection === 'exams') fireEvent.change(within(dialog).getByLabelText('Fecha *'), { target: { value: '2026-12-12' } })
  if (collection === 'tasks') await user.click(within(dialog).getByLabelText('Sin fecha de entrega'))
  const submit = within(dialog).getByRole('button', { name: collection === 'teachers' ? 'Agregar' : label })
  await user.click(submit)
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('No se pudo')
  expect(within(dialog).getByLabelText(field)).toHaveValue('Prueba')
  await user.click(submit)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(save).toHaveBeenLastCalledWith(collection, expect.objectContaining({ [collection === 'teachers' || collection === 'subjects' ? 'name' : 'title']: 'Prueba' }))
  if (collection === 'tasks') expect(screen.getByText(/Sin fecha de entrega/)).toBeInTheDocument()
  if (collection === 'exams' || collection === 'subjects') expect(screen.getByRole('heading', { name: 'Prueba' })).toBeInTheDocument()
})
it('limpia y deshabilita la fecha; permite volver a seleccionarla', async () => {
  render(<Harness Page={TasksPage} save={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))
  const date = screen.getByLabelText('Fecha de entrega')
  fireEvent.change(date, { target: { value: '2026-12-12' } })
  await userEvent.click(screen.getByLabelText('Sin fecha de entrega'))
  expect(date).toBeDisabled(); expect(date).toHaveValue('')
  await userEvent.click(screen.getByLabelText('Sin fecha de entrega'))
  expect(date).toBeEnabled(); expect(date).toBeRequired()
})
it.each(['Cerrar formulario', 'Cancelar', 'Escape'])('cierra mediante %s y restaura el foco y scroll', async method => {
  render(<Harness Page={TasksPage} save={vi.fn()} />)
  const trigger = screen.getByRole('button', { name: 'Crear tarea' })
  await userEvent.click(trigger)
  const dialog = screen.getByRole('dialog')
  expect(screen.getByLabelText('Título *')).toHaveFocus()
  expect(document.body.style.overflow).toBe('hidden')
  if (method === 'Escape') fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }))
  else await userEvent.click(screen.getByRole('button', { name: method }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
  expect(document.body.style.overflow).toBe('')
})
it('no considera vencida una tarea sin fecha', () => {
  expect(formatDate(null)).toBe('Sin fecha de entrega')
  expect(daysRemaining(null)).toBeNull()
  expect(urgencyClass(daysRemaining(null))).toBe('info')
})
