import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../context/auth-context.js'
import { AppContext } from '../../context/app-context.js'
import { AppRoutes } from '../../routes/AppRoutes.jsx'
import { GuidedOnboarding } from './GuidedOnboarding.jsx'
import { getOnboarding, saveOnboarding, OPEN_TUTORIAL_EVENT } from '../../services/onboarding.service.js'
import { saveSession, clearSession } from '../../utils/authSession.js'
import { tourSteps } from '../../utils/guidedTour.js'
vi.mock('../../services/onboarding.service.js', async original => ({ ...await original(), getOnboarding: vi.fn(), saveOnboarding: vi.fn() }))
vi.mock('../../services/notifications.service.js', async original => ({ ...await original(), getNotificationPreferences: vi.fn(async () => ({ enabled: false, exams_enabled: false, tasks_enabled: false, timezone: 'America/Argentina/Cordoba', exam_default_time: '09:00', task_default_time: '09:00', exam_style: 'formal', task_style: 'formal', quiet_hours_enabled: false })), getNotificationRules: vi.fn(async () => []), getNotificationPhrases: vi.fn(async () => []), getPushConfig: vi.fn(async () => ({ enabled: false })) }))
let progress, context, user
const Location = () => <output aria-label="Ruta del recorrido">{useLocation().pathname}</output>
const mount = ({ routes = true, loading = false } = {}) => render(<MemoryRouter><AuthContext.Provider value={{ user }}><AppContext.Provider value={{ ...context, isLoading: loading }}>{routes ? <AppRoutes /> : <GuidedOnboarding />}<Location /></AppContext.Provider></AuthContext.Provider></MemoryRouter>)
const next = async () => {
  const button = await screen.findByRole('button', { name: 'Siguiente' })
  await waitFor(() => expect(button).toBeEnabled())
  await userEvent.click(button)
}
beforeEach(() => {
  user = { id: 7, role: 'student' }; saveSession({ user, token: 'test-only' })
  progress = { version: 1, status: 'not_started', step: 0, revision: 0 }
  context = { data: { profile: { id: 2, name: 'Ana', nickname: 'Ani' }, teachers: [], subjects: [], tasks: [], exams: [], notes: [], notifications: [], activities: [] }, addItem: vi.fn(), updateItem: vi.fn(), removeItem: vi.fn(), refreshNotifications: vi.fn(), notify: vi.fn() }
  getOnboarding.mockImplementation(async () => ({ ...progress }))
  saveOnboarding.mockImplementation(async values => { progress = { version: 1, ...values, revision: values.revision + 1 }; return { ...progress } })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { clearSession(); vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllGlobals(); delete Element.prototype.scrollIntoView })
describe('recorrido automático sobre Fokus real', () => {
  it('espera a que los datos estén listos y no escribe al ofrecer la bienvenida', async () => {
    const view = mount({ routes: false, loading: true })
    expect(getOnboarding).not.toHaveBeenCalled()
    view.unmount(); mount({ routes: false })
    expect(await screen.findByRole('button', { name: 'Comenzar recorrido' })).toBeInTheDocument()
    expect(saveOnboarding).not.toHaveBeenCalled()
  })
  it('navega todos los pasos, abre formularios y resalta elementos sin guardar registros', async () => {
    mount(); await userEvent.click(await screen.findByRole('button', { name: 'Comenzar recorrido' }))
    for (let index = 0; index < tourSteps.length; index++) {
      await waitFor(() => expect(document.querySelector(tourSteps[index].target)).toHaveClass('guided-tour-highlight'))
      expect(screen.getByLabelText('Ruta del recorrido')).toHaveTextContent(tourSteps[index].path)
      if (tourSteps[index].open) expect(document.querySelector('[data-tour-card]').closest('dialog')).not.toBeNull()
      if (index < tourSteps.length - 1) await next()
    }
    await userEvent.click(screen.getByRole('button', { name: 'Completar recorrido' }))
    await waitFor(() => expect(progress.status).toBe('completed'))
    expect(screen.queryByRole('region', { name: 'Tutorial de Fokus' })).not.toBeInTheDocument()
    expect(context.addItem).not.toHaveBeenCalled(); expect(context.updateItem).not.toHaveBeenCalled()
    expect(getOnboarding).toHaveBeenCalledOnce()
  })
  it.each(['skipped', 'completed'])('no inicia automáticamente después de %s', async status => {
    progress = { ...progress, status, step: 7, revision: 3 }
    mount({ routes: false }); await waitFor(() => expect(getOnboarding).toHaveBeenCalledOnce())
    expect(screen.queryByRole('button', { name: 'Comenzar recorrido' })).not.toBeInTheDocument()
    expect(saveOnboarding).not.toHaveBeenCalled()
  })
  it('recuerda omitir entre cargas y permite repetirlo voluntariamente', async () => {
    const view = mount(); await userEvent.click(await screen.findByRole('button', { name: 'Omitir' }))
    await waitFor(() => expect(progress.status).toBe('skipped'))
    view.unmount(); mount(); await waitFor(() => expect(getOnboarding).toHaveBeenCalledTimes(2))
    fireEvent(window, new Event(OPEN_TUTORIAL_EVENT))
    await userEvent.click(await screen.findByRole('button', { name: 'Comenzar recorrido' }))
    await waitFor(() => expect(progress).toMatchObject({ status: 'in_progress', step: 0 }))
  })
  it('permite retroceder, pausar con Escape y retomar el paso persistido en otra carga', async () => {
    const view = mount(); await userEvent.click(await screen.findByRole('button', { name: 'Comenzar recorrido' }))
    await next(); await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await waitFor(() => expect(progress.step).toBe(0))
    await next(); fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(progress).toMatchObject({ status: 'paused', step: 1 }))
    view.unmount(); mount()
    await userEvent.click(await screen.findByRole('button', { name: 'Retomar recorrido' }))
    await waitFor(() => expect(document.querySelector('[data-tour="dashboard-upcoming"]')).toHaveClass('guided-tour-highlight'))
  })
  it('pausa al editar un formulario y conserva el texto del estudiante', async () => {
    progress = { ...progress, status: 'paused', step: 5, revision: 4 }
    mount(); await userEvent.click(await screen.findByRole('button', { name: 'Retomar recorrido' }))
    await screen.findByLabelText('Título *')
    await waitFor(() => expect(document.querySelector('#exam-title')).toHaveClass('guided-tour-highlight'))
    await userEvent.type(screen.getByLabelText('Título *'), 'Mi examen real')
    await waitFor(() => expect(progress.status).toBe('paused'))
    expect(screen.getByLabelText('Título *')).toHaveValue('Mi examen real')
    expect(context.addItem).not.toHaveBeenCalled()
  })
  it('mantiene la página ante fallo al guardar, sin fingir progreso', async () => {
    mount(); saveOnboarding.mockRejectedValueOnce(new Error('Sin conexión'))
    await userEvent.click(await screen.findByRole('button', { name: 'Comenzar recorrido' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    expect(progress.status).toBe('not_started')
    expect(screen.queryByRole('region', { name: 'Tutorial de Fokus' })).not.toBeInTheDocument()
  })
  it('no interrumpe estudiantes con actividades existentes', async () => {
    context.data.subjects = [{ id: 1, name: 'Ya registrada' }]
    mount({ routes: false }); await waitFor(() => expect(getOnboarding).toHaveBeenCalledOnce())
    expect(screen.queryByRole('button', { name: 'Comenzar recorrido' })).not.toBeInTheDocument()
  })
  it('excluye superadmin y cuentas sin perfil real', async () => {
    user.role = 'superadmin'; const view = mount({ routes: false })
    expect(getOnboarding).not.toHaveBeenCalled()
    view.unmount(); user.role = 'student'; context.data.profile = {}
    mount({ routes: false }); expect(getOnboarding).not.toHaveBeenCalled()
  })
})
