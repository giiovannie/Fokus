import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { WebPushControls } from './WebPushControls.jsx'
import { getPushConfig, getPushSubscriptions } from '../../services/notifications.service.js'
import { activatePush, deactivatePush } from '../../services/pushNotifications.js'
vi.mock('../../services/notifications.service.js', () => ({ getPushConfig: vi.fn(), getPushSubscriptions: vi.fn() }))
vi.mock('../../services/pushNotifications.js', () => ({ activatePush: vi.fn(), deactivatePush: vi.fn(), getPushDeviceId: () => 'current-device' }))
beforeEach(() => {
  getPushConfig.mockResolvedValue({ enabled: true, public_key: 'public-only' })
  getPushSubscriptions.mockResolvedValue([])
  vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn().mockResolvedValue(null) } })
})
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })
describe('controles de activación Push', () => {
  it('no pide permiso ni registra en la carga y permite activar y desactivar voluntariamente', async () => {
    const onChange = vi.fn()
    activatePush.mockResolvedValue({ id: 12, device_id: 'current-device', device_label: 'Mi PC' }); deactivatePush.mockResolvedValue(null)
    render(<WebPushControls onChange={onChange} />)
    await screen.findByRole('button', { name: 'Activar notificaciones Push' })
    expect(activatePush).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Nombre de este dispositivo'), { target: { value: 'Mi PC' } })
    await userEvent.click(screen.getByRole('button', { name: 'Activar notificaciones Push' }))
    await screen.findByRole('button', { name: 'Desactivar notificaciones Push' })
    expect(activatePush).toHaveBeenCalledWith('public-only', 'Mi PC'); expect(onChange).toHaveBeenLastCalledWith(12)
    await userEvent.click(screen.getByRole('button', { name: 'Desactivar notificaciones Push' }))
    await screen.findByRole('button', { name: 'Activar notificaciones Push' })
    expect(deactivatePush).toHaveBeenCalledWith(12); expect(onChange).toHaveBeenLastCalledWith(null)
  })
  it('permite elegir otro dispositivo propio para probar con Fokus cerrada allí', async () => {
    getPushSubscriptions.mockResolvedValue([{ id: 1, device_id: 'first', device_label: 'PC' }, { id: 2, device_id: 'second', device_label: 'Celular' }])
    const onChange = vi.fn(); render(<WebPushControls onChange={onChange} />)
    await screen.findByLabelText('Dispositivo para la prueba desde Express')
    fireEvent.change(screen.getByLabelText('Dispositivo para la prueba desde Express'), { target: { value: '2' } })
    expect(onChange).toHaveBeenLastCalledWith(2); expect(activatePush).not.toHaveBeenCalled()
  })
  it('explica configuración pendiente y mantiene las preferencias utilizables', async () => {
    getPushConfig.mockResolvedValue({ enabled: false, public_key: null })
    render(<WebPushControls onChange={vi.fn()} />)
    expect(await screen.findByText(/El servidor todavía/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Activar notificaciones Push' })).not.toBeInTheDocument()
    expect(getPushSubscriptions).not.toHaveBeenCalled()
  })
  it('muestra rechazo de permiso sin simular una activación exitosa', async () => {
    activatePush.mockRejectedValue(new Error('Las notificaciones están bloqueadas'))
    render(<WebPushControls onChange={vi.fn()} />)
    await screen.findByRole('button', { name: 'Activar notificaciones Push' })
    await userEvent.click(screen.getByRole('button', { name: 'Activar notificaciones Push' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('bloqueadas')
    expect(screen.queryByRole('button', { name: 'Desactivar notificaciones Push' })).not.toBeInTheDocument()
  })
  it('permite reintentar una falla de la API sin cambiar preferencias', async () => {
    getPushConfig.mockRejectedValueOnce(new Error('API no disponible'))
    render(<WebPushControls onChange={vi.fn()} />)
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar notificaciones Push' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Activar notificaciones Push' })).toBeEnabled())
  })
})
