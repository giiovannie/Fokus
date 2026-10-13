import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { AppContext } from '../context/app-context.js'
import { ExamsPage } from './ExamsPage.jsx'
import { TasksPage } from './TasksPage.jsx'
import { SubjectsPage } from './SubjectsPage.jsx'

let stored, fail
const Harness = ({ tasks = false, subjects = false }) => {
  const [data, setData] = useState({ teachers: subjects ? [{ id: 23, name: 'Profesor existente' }] : [], subjects: subjects ? [{ id: 22, name: 'Materia existente', teacher_id: 23 }] : [], exams: [], tasks: [], notes: [] })
  const addItem = vi.fn(async (collection, values, onCreated) => {
    if (fail) return false
    const created = { id: stored.length + 1, ...values }
    stored.push({ collection, ...created })
    setData(current => ({ ...current, [collection]: [...current[collection], created] }))
    onCreated?.(created)
    return true
  })
  return <AppContext.Provider value={{ data, addItem, notify: vi.fn(), updateItem: vi.fn(), removeItem: vi.fn() }}>{subjects ? <SubjectsPage /> : tasks ? <TasksPage /> : <ExamsPage />}</AppContext.Provider>
}
beforeEach(() => { stored = []; fail = false })
afterEach(() => vi.clearAllMocks())
describe('creación asistida con formularios reales', () => {
  it('vuelve a la edición de materia sin duplicar formularios al agregar profesor', async () => {
    render(<Harness subjects />); const keyboard = userEvent.setup()
    await keyboard.click(screen.getByRole('button', { name: 'Editar' }))
    await keyboard.type(screen.getByLabelText('Nombre'), ' con borrador')
    await keyboard.click(screen.getByRole('button', { name: 'Crear profesor aquí' }))
    await keyboard.type(screen.getByLabelText('Nombre del profesor'), 'Nuevo profesor')
    await keyboard.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Agregar' }))
    expect(await screen.findByLabelText('Profesor')).toHaveValue('1')
    expect(screen.getByLabelText('Nombre')).toHaveValue('Materia existente con borrador')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(stored.map(row => row.collection)).toEqual(['teachers'])
  })
  it.each([false, true])('conserva el borrador y vuelve con materia y profesor reales (tarea=%s)', async tasks => {
    render(<Harness tasks={tasks} />)
    const keyboard = userEvent.setup()
    await keyboard.click(screen.getByRole('button', { name: tasks ? 'Crear tarea' : 'Crear examen' }))
    await keyboard.type(screen.getByLabelText('Título *'), 'Borrador original')
    fireEvent.change(screen.getByLabelText(tasks ? 'Fecha de entrega' : 'Fecha *'), { target: { value: '2026-11-20' } })
    await keyboard.type(screen.getByLabelText(tasks ? 'Descripción' : 'Temas'), 'No perder estos datos')
    await keyboard.click(screen.getByRole('button', { name: 'Crear materia aquí' }))
    expect(screen.queryByLabelText('Título *')).not.toBeInTheDocument()
    await keyboard.type(screen.getByLabelText('Nombre'), 'Programación II')
    await keyboard.click(screen.getByRole('button', { name: 'Crear profesor aquí' }))
    expect(stored).toHaveLength(0)
    await keyboard.type(screen.getByLabelText('Nombre del profesor'), 'Ada')
    await keyboard.click(screen.getByRole('button', { name: 'Guardar profesor y volver' }))
    expect(await screen.findByLabelText('Nombre')).toHaveValue('Programación II')
    expect(screen.getByLabelText('Profesor')).toHaveValue('1')
    await keyboard.click(screen.getByRole('button', { name: 'Guardar materia y volver' }))
    expect(await screen.findByLabelText('Título *')).toHaveValue('Borrador original')
    expect(screen.getByLabelText('Materia *')).toHaveValue('2')
    expect(screen.getByLabelText(tasks ? 'Fecha de entrega' : 'Fecha *')).toHaveValue('2026-11-20')
    expect(screen.getByLabelText(tasks ? 'Descripción' : 'Temas')).toHaveValue('No perder estos datos')
    expect(stored.map(row => row.collection)).toEqual(['teachers', 'subjects'])
    await keyboard.click(within(screen.getByRole('dialog')).getByRole('button', { name: tasks ? 'Crear tarea' : 'Crear examen', exact: true }))
    await waitFor(() => expect(stored).toHaveLength(3))
    expect(stored[2]).toMatchObject({ collection: tasks ? 'tasks' : 'exams', title: 'Borrador original', subject_id: 2 })
  })
  it('cancelar vuelve al examen sin crear nada ni perder el borrador', async () => {
    render(<Harness />); const keyboard = userEvent.setup()
    await keyboard.click(screen.getByRole('button', { name: 'Crear examen' }))
    await keyboard.type(screen.getByLabelText('Título *'), 'Pendiente')
    await keyboard.click(screen.getByRole('button', { name: 'Crear materia aquí' }))
    await keyboard.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByLabelText('Título *')).toHaveValue('Pendiente')
    expect(stored).toHaveLength(0)
  })
  it('conserva nombre de materia y profesor ante error, sin inventar registros', async () => {
    render(<Harness />); const keyboard = userEvent.setup()
    await keyboard.click(screen.getByRole('button', { name: 'Crear examen' }))
    await keyboard.click(screen.getByRole('button', { name: 'Crear materia aquí' }))
    await keyboard.type(screen.getByLabelText('Nombre'), 'Materia real')
    await keyboard.click(screen.getByRole('button', { name: 'Crear profesor aquí' }))
    await keyboard.type(screen.getByLabelText('Nombre del profesor'), 'Nombre conservado')
    fail = true
    await keyboard.click(screen.getByRole('button', { name: 'Guardar profesor y volver' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Tus datos se conservaron')
    expect(screen.getByLabelText('Nombre del profesor')).toHaveValue('Nombre conservado')
    expect(stored).toHaveLength(0)
    await keyboard.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByLabelText('Nombre')).toHaveValue('Materia real')
    expect(screen.getByLabelText('Profesor')).toBeRequired()
  })
})
