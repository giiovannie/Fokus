import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { WebPushControls } from './WebPushControls.jsx'
import { getPushConfig, getPushSubscriptions } from '../../services/notifications.service.js'
import { activatePush, synchronizePush } from '../../services/pushNotifications.js'
vi.mock('../../services/notifications.service.js', () => ({ getPushConfig: vi.fn(), getPushSubscriptions: vi.fn() }))
vi.mock('../../services/pushNotifications.js', () => ({ activatePush: vi.fn(), synchronizePush: vi.fn(), getPushDeviceId: () => 'current-device' }))
beforeEach(() => {
  synchronizePush.mockResolvedValue(null)
  vi.stubGlobal('Notification', { permission: 'default' })
  getPushConfig.mockResolvedValue({ enabled: true, public_key: 'public-only' })
  getPushSubscriptions.mockResolvedValue([])
  vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn().mockResolvedValue(null) } })
})
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })
describe('controles de activación Push', () => {
  it('activa voluntariamente y no ofrece el botón de desactivación', async () => {
    activatePush.mockResolvedValue({ id: 12 })
    render(<WebPushControls />)
    await screen.findByRole('button', { name: 'Activar notificaciones Push' })
    expect(activatePush).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Nombre de este dispositivo'), { target: { value: 'Mi PC' } })
    await userEvent.click(screen.getByRole('button', { name: 'Activar notificaciones Push' }))
    expect(await screen.findByText('Notificaciones Push activas en este dispositivo.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desactivar notificaciones Push' })).not.toBeInTheDocument()
    expect(activatePush).toHaveBeenCalledWith('public-only', 'Mi PC')
  })
  it('reconoce una suscripción existente sin volver a activarla', async () => {
    vi.stubGlobal('Notification', { permission: 'granted' })
    synchronizePush.mockResolvedValue({ id: 12, device_label: 'Mi PC' })
    render(<WebPushControls />)
    await screen.findByText('Notificaciones Push activas en este dispositivo.')
    expect(screen.getByLabelText('Nombre de este dispositivo')).toHaveValue('Mi PC')
    expect(activatePush).not.toHaveBeenCalled()
  })
  it('explica el permiso denegado y revisa al regresar del navegador', async () => {
    vi.stubGlobal('Notification', { permission: 'denied' })
    render(<WebPushControls />)
    expect(await screen.findByText(/Las notificaciones están bloqueadas. En Chrome/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Activar notificaciones Push' })).not.toBeInTheDocument()
    vi.stubGlobal('Notification', { permission: 'default' })
    fireEvent.focus(window)
    expect(await screen.findByRole('button', { name: 'Activar notificaciones Push' })).toBeEnabled()
    expect(activatePush).not.toHaveBeenCalled()
  })
  it('no ofrece un destino de prueba y conserva la activación del navegador', async () => {
    getPushSubscriptions.mockResolvedValue([{ id: 1, device_id: 'first', device_label: 'PC' }])
    render(<WebPushControls />)
    await screen.findByRole('button', { name: 'Activar notificaciones Push' })
    expect(screen.queryByLabelText('Dispositivo para la prueba desde Express')).not.toBeInTheDocument()
    expect(activatePush).not.toHaveBeenCalled()
  })
  it('explica configuración pendiente y mantiene las preferencias utilizables', async () => {
    getPushConfig.mockResolvedValue({ enabled: false, public_key: null })
    render(<WebPushControls />)
    expect(await screen.findByText(/El servidor todavía/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Activar notificaciones Push' })).not.toBeInTheDocument()
    expect(getPushSubscriptions).not.toHaveBeenCalled()
  })
  it('muestra rechazo de permiso sin simular una activación exitosa', async () => {
    activatePush.mockImplementationOnce(async () => { Notification.permission = 'denied'; throw new Error('Las notificaciones están bloqueadas') })
    render(<WebPushControls />)
    await screen.findByRole('button', { name: 'Activar notificaciones Push' })
    await userEvent.click(screen.getByRole('button', { name: 'Activar notificaciones Push' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('bloqueadas')
    expect(screen.getByText(/Las notificaciones están bloqueadas. En Chrome/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Activar notificaciones Push' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desactivar notificaciones Push' })).not.toBeInTheDocument()
  })
  it('permite reintentar una falla de la API sin cambiar preferencias', async () => {
    getPushConfig.mockRejectedValueOnce(new Error('API no disponible'))
    render(<WebPushControls />)
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar notificaciones Push' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Activar notificaciones Push' })).toBeEnabled())
  })
})
