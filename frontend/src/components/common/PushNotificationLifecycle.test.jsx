import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { PushNotificationLifecycle } from './PushNotificationLifecycle.jsx'
import { AuthContext } from '../../context/auth-context.js'
import { getNotificationPreferences, getPushConfig, getPushSubscriptions } from '../../services/notifications.service.js'
import { activatePush, synchronizePush } from '../../services/pushNotifications.js'
vi.mock('../../services/notifications.service.js', () => ({ getNotificationPreferences: vi.fn(), getPushConfig: vi.fn(), getPushSubscriptions: vi.fn() }))
vi.mock('../../services/pushNotifications.js', async original => ({ ...await original(), activatePush: vi.fn(), synchronizePush: vi.fn() }))
const mount = () => render(<MemoryRouter><AuthContext.Provider value={{ user: { id: 7, role: 'student' } }}><PushNotificationLifecycle /></AuthContext.Provider></MemoryRouter>)
const created = (type = 'exam', userId = 7) => fireEvent(window, new CustomEvent('fokus:reminder-created', { detail: { type, userId } }))
beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('Notification', { permission: 'default' }); vi.stubGlobal('isSecureContext', true); vi.stubGlobal('PushManager', function () {})
  vi.stubGlobal('navigator', { serviceWorker: {} })
  getNotificationPreferences.mockResolvedValue({ enabled: true, exams_enabled: true, tasks_enabled: true })
  getPushConfig.mockResolvedValue({ enabled: true, public_key: 'key' }); getPushSubscriptions.mockResolvedValue([])
  synchronizePush.mockResolvedValue({ id: 12 }); activatePush.mockResolvedValue({ id: 12 })
})
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); localStorage.clear() })
describe('recordatorios sencillos durante el uso de Fokus', () => {
  it('ofrece permiso para agenda aunque exámenes y tareas estén desactivados', async () => {
    getNotificationPreferences.mockResolvedValue({ enabled: true, exams_enabled: false, tasks_enabled: false })
    mount(); await waitFor(() => expect(getPushConfig).toHaveBeenCalledOnce()); created('agenda')
    expect(await screen.findByRole('button', { name: 'Permitir recordatorios' })).toBeInTheDocument()
    expect(activatePush).not.toHaveBeenCalled()
  })
  it('sincroniza para agenda con autorización previa aunque no haya avisos de exámenes ni tareas', async () => {
    localStorage.setItem('fokus-push-choice:7', 'authorized'); Notification.permission = 'granted'
    getNotificationPreferences.mockResolvedValue({ enabled: true, exams_enabled: false, tasks_enabled: false })
    mount(); await waitFor(() => expect(synchronizePush).toHaveBeenCalledOnce())
    expect(activatePush).not.toHaveBeenCalled()
  })
  it('ofrece tras crear un evento y pide activar solamente al hacer clic', async () => {
    mount(); await waitFor(() => expect(getPushConfig).toHaveBeenCalledOnce())
    expect(screen.queryByRole('button', { name: 'Permitir recordatorios' })).not.toBeInTheDocument()
    created()
    await screen.findByText(/Fokus puede recordarte tus exámenes/)
    expect(activatePush).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Permitir recordatorios' }))
    expect(activatePush).toHaveBeenCalledWith('key', 'Este dispositivo')
    expect(screen.queryByRole('button', { name: 'Permitir recordatorios' })).not.toBeInTheDocument()
  })
  it('recuerda Ahora no entre cargas y no vuelve a ofrecer', async () => {
    const view = mount(); await waitFor(() => expect(getPushConfig).toHaveBeenCalledOnce())
    created('task'); await userEvent.click(await screen.findByRole('button', { name: 'Ahora no' }))
    view.unmount(); mount(); created()
    await waitFor(() => expect(getPushConfig).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('button', { name: 'Permitir recordatorios' })).not.toBeInTheDocument()
    expect(activatePush).not.toHaveBeenCalled(); expect(synchronizePush).not.toHaveBeenCalled()
  })
  it('no insiste ante rechazo del navegador', async () => {
    Notification.permission = 'denied'
    mount(); await waitFor(() => expect(getPushConfig).toHaveBeenCalledOnce()); created()
    expect(screen.queryByRole('button', { name: 'Permitir recordatorios' })).not.toBeInTheDocument()
    expect(activatePush).not.toHaveBeenCalled()
  })
  it('comprueba al cargar y evita solicitudes repetidas al recuperar foco', async () => {
    localStorage.setItem('fokus-push-choice:7', 'authorized'); Notification.permission = 'granted'
    mount(); await waitFor(() => expect(synchronizePush).toHaveBeenCalledOnce())
    expect(synchronizePush).toHaveBeenCalledWith('key', [], { allowRenewal: true })
    fireEvent.focus(window); fireEvent(window, new Event('online'))
    expect(getPushSubscriptions).toHaveBeenCalledOnce(); expect(activatePush).not.toHaveBeenCalled()
  })
  it('respeta los recordatorios desactivados aunque tenga autorización', async () => {
    localStorage.setItem('fokus-push-choice:7', 'authorized'); Notification.permission = 'granted'
    getNotificationPreferences.mockResolvedValue({ enabled: false, exams_enabled: true })
    mount(); await waitFor(() => expect(getPushConfig).toHaveBeenCalledOnce()); created()
    expect(synchronizePush).not.toHaveBeenCalled(); expect(getPushSubscriptions).not.toHaveBeenCalled()
  })
  it('ignora eventos de otro usuario y comunica cuando hace falta un gesto', async () => {
    localStorage.setItem('fokus-push-choice:7', 'authorized'); Notification.permission = 'granted'
    synchronizePush.mockRejectedValue(new DOMException('Gesture required', 'NotAllowedError'))
    mount(); expect(await screen.findByRole('link', { name: 'Revisar mis notificaciones' })).toBeInTheDocument()
    created('exam', 8)
    expect(activatePush).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Permitir recordatorios' })).not.toBeInTheDocument()
  })
})
