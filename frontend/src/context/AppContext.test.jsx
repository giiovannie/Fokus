import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAppData } from '../hooks/useAppData.js'
import { clearSession, saveSession } from '../utils/authSession.js'
import { AppProvider } from './AppContext.jsx'
import { AuthProvider } from './AuthContext.jsx'

const response = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(data),
})

const createFetchMock = () => vi.fn(async (url, options = {}) => {
  const path = String(url)

  if (options.method === 'POST' && path.endsWith('/teachers')) {
    return response({ id: 8, name: 'Nuevo profesor' }, 201)
  }
  if (options.method === 'DELETE' && path.endsWith('/tasks/9')) {
    return response({ message: 'Tarea eliminada' })
  }
  if (path.endsWith('/profiles/7')) return response({ message: 'El perfil no fue encontrado' }, 404)
  if (path.endsWith('/teachers')) return response([{ id: 4, name: 'Ada' }])
  if (path.endsWith('/subjects')) return response([{ id: 5, name: 'Matemática', teacher: { id: 4, name: 'Ada' } }])
  if (path.endsWith('/tasks')) return response([{ id: 9, title: 'Guía', subject_id: 5, status: 'pending' }])
  if (path.endsWith('/tasks/9/notes')) return response([{ id: 10, task_id: 9, content: 'Repasar' }])
  if (path.endsWith('/exams')) return response([])
  if (path.endsWith('/study-activities')) return response([])
  if (path.endsWith('/notifications')) return response([])

  throw new Error(`Solicitud inesperada: ${path}`)
})

const AppConsumer = () => {
  const { addItem, data, error, isLoading, removeItem, updateItem, toast } = useAppData()

  if (isLoading) return <span>Cargando</span>
  if (error) return <span>{error}</span>

  return (
    <>
      <span>{data.subjects[0]?.name}:{data.subjects[0]?.teacher_id}</span>
      <span>Profesores:{data.teachers.length}</span>
      <span>Tareas:{data.tasks.length}</span>
      <span>Notas:{data.notes.length}</span>
      <span>Notificaciones:{data.notifications.length}</span>
      <span>{toast?.message}</span>
      <button onClick={() => addItem('exams', { title: 'Parcial', exam_date: '2026-10-12', subject_id: 5 })} type="button">Agregar examen</button>
      <button onClick={() => addItem('tasks', { title: 'Entrega', due_date: '2026-10-12', subject_id: 5 })} type="button">Agregar entrega</button>
      <button onClick={() => updateItem('tasks', 9, { status: 'completed' })} type="button">Completar tarea</button>
      <button onClick={() => addItem('teachers', { name: 'Nuevo profesor' })} type="button">Agregar profesor</button>
      <button onClick={() => removeItem('tasks', 9)} type="button">Eliminar tarea</button>
    </>
  )
}

const renderApp = () => render(
  <AuthProvider>
    <AppProvider><AppConsumer /></AppProvider>
  </AuthProvider>,
)

describe('AppProvider', () => {
  afterEach(() => {
    clearSession()
    vi.unstubAllGlobals()
  })

  it('carga y normaliza los recursos del usuario', async () => {
    saveSession({ user: { id: 7, email: 'user@example.com' }, token: 'jwt-token' })
    vi.stubGlobal('fetch', createFetchMock())

    renderApp()

    expect(await screen.findByText('Matemática:4')).toBeInTheDocument()
    expect(screen.getByText('Profesores:1')).toBeInTheDocument()
    expect(screen.getByText('Notas:1')).toBeInTheDocument()
  })

  it('persiste altas y aplica eliminaciones relacionadas', async () => {
    const user = userEvent.setup()
    saveSession({ user: { id: 7, email: 'user@example.com' }, token: 'jwt-token' })
    const fetchMock = createFetchMock()
    vi.stubGlobal('fetch', fetchMock)
    renderApp()
    await screen.findByText('Matemática:4')

    await user.click(screen.getByRole('button', { name: 'Agregar profesor' }))
    expect(await screen.findByText('Profesores:2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Eliminar tarea' }))
    expect(await screen.findByText('Tareas:0')).toBeInTheDocument()
    expect(screen.getByText('Notas:0')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/tasks/9'), expect.objectContaining({ method: 'DELETE' }))
  })
  it.each(['examen', 'entrega'])('actualiza notificaciones al crear un %s sin volver a iniciar sesi?n', async (event) => {
    const user = userEvent.setup()
    saveSession({ user: { id: 7, email: 'user@example.com' }, token: 'jwt-token' })
    const base = createFetchMock()
    let created = false
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (options.method === 'POST' && /\/(exams|tasks)$/.test(String(url))) {
        created = true
        return response({ id: 20, subject_id: 5 }, 201)
      }
      if (String(url).endsWith('/notifications')) return response(created ? [{ id: 1, type: event === 'examen' ? 'exam' : 'task', message: 'Evento ma?ana', read: false }] : [])
      return base(url, options)
    }))
    renderApp()
    await screen.findByText('Notificaciones:0')
    await user.click(screen.getByRole('button', { name: event === 'examen' ? 'Agregar examen' : 'Agregar entrega' }))
    expect(await screen.findByText('Notificaciones:1')).toBeInTheDocument()
  })

  it('retira el aviso al completar una tarea', async () => {
    const user = userEvent.setup()
    saveSession({ user: { id: 7, email: 'user@example.com' }, token: 'jwt-token' })
    const base = createFetchMock()
    let completed = false
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (options.method === 'PATCH') {
        completed = true
        return response({ id: 9, status: 'completed' })
      }
      if (String(url).endsWith('/notifications')) return response(completed ? [] : [{ id: 1, type: 'task', message: 'Entrega ma?ana', read: false }])
      return base(url, options)
    }))
    renderApp()
    await screen.findByText('Notificaciones:1')
    await user.click(screen.getByRole('button', { name: 'Completar tarea' }))
    expect(await screen.findByText('Notificaciones:0')).toBeInTheDocument()
  })

  it('conserva el alta si falla ?nicamente la consulta de notificaciones', async () => {
    const user = userEvent.setup()
    saveSession({ user: { id: 7, email: 'user@example.com' }, token: 'jwt-token' })
    const base = createFetchMock()
    let created = false
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (options.method === 'POST' && String(url).endsWith('/tasks')) {
        created = true
        return response({ id: 20, subject_id: 5 }, 201)
      }
      if (created && String(url).endsWith('/notifications')) throw new Error('Sin conexi?n')
      return base(url, options)
    }))
    renderApp()
    await screen.findByText('Tareas:1')
    await user.click(screen.getByRole('button', { name: 'Agregar entrega' }))
    expect(await screen.findByText('Tareas:2')).toBeInTheDocument()
    expect(await screen.findByText(/El cambio se guard?/)).toBeInTheDocument()
  })

})
