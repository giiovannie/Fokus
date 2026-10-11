import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { activatePush, cleanupPushOnLogout, deactivatePush, getPushDeviceId } from './pushNotifications.js'
import { savePushSubscription, deletePushSubscription } from './notifications.service.js'
import { saveSession } from '../utils/authSession.js'
vi.mock('./notifications.service.js', () => ({ savePushSubscription: vi.fn(), deletePushSubscription: vi.fn() }))
let subscription, registration, notification
const publicKey = btoa(String.fromCharCode(...new Uint8Array(65).fill(4))).replace(/=/g, '')
beforeEach(() => {
  localStorage.clear(); saveSession({ token: 'test', user: { id: 7 } })
  subscription = { toJSON: vi.fn().mockReturnValue({ endpoint: 'https://fcm.googleapis.com/test', keys: { p256dh: 'test', auth: 'test' } }), unsubscribe: vi.fn().mockResolvedValue(true) }
  registration = { active: {}, pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe: vi.fn().mockResolvedValue(subscription) } }
  notification = { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') }
  vi.stubGlobal('isSecureContext', true); vi.stubGlobal('Notification', notification); vi.stubGlobal('PushManager', function () {})
  vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn().mockResolvedValue(registration), register: vi.fn().mockResolvedValue(registration) } })
  savePushSubscription.mockResolvedValue({ id: 12, device_id: 'test', device_label: 'Mi PC' }); deletePushSubscription.mockResolvedValue(null)
})
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); localStorage.clear() })
describe('activación voluntaria de Web Push', () => {
  it('mantiene el dispositivo, solicita permiso solamente al activar y registra claves públicas del navegador', async () => {
    expect(getPushDeviceId()).toBe(getPushDeviceId())
    expect(notification.requestPermission).not.toHaveBeenCalled()
    const result = await activatePush(publicKey, 'Mi PC')
    expect(notification.requestPermission).toHaveBeenCalledOnce()
    expect(registration.pushManager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) })
    expect(savePushSubscription).toHaveBeenCalledWith({ device_id: getPushDeviceId(), device_label: 'Mi PC', subscription: subscription.toJSON() })
    expect(result.id).toBe(12)
    expect(JSON.parse(localStorage.getItem('fokus-push-owner'))).toEqual({ id: 12, user_id: 7 })
  })
  it('rechaza permiso denegado sin registrar ni guardar suscripción', async () => {
    notification.requestPermission.mockResolvedValue('denied')
    await expect(activatePush(publicKey, 'Mi PC')).rejects.toThrow('bloqueadas')
    expect(savePushSubscription).not.toHaveBeenCalled()
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled()
  })
  it('rechaza navegadores incompatibles o sitios inseguros sin pedir permisos', async () => {
    vi.stubGlobal('isSecureContext', false)
    await expect(activatePush(publicKey, 'Mi PC')).rejects.toThrow('HTTPS')
    vi.stubGlobal('isSecureContext', true); vi.stubGlobal('PushManager', undefined)
    await expect(activatePush(publicKey, 'Mi PC')).rejects.toThrow('no admite')
    expect(notification.requestPermission).not.toHaveBeenCalled()
  })
  it('registra un service worker activo si todavía no existe', async () => {
    navigator.serviceWorker.getRegistration.mockResolvedValue(null)
    await activatePush(publicKey, 'Mi PC')
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js')
  })
  it('anula una nueva suscripción si falla el registro del servidor', async () => {
    savePushSubscription.mockRejectedValue(new Error('API no disponible'))
    await expect(activatePush(publicKey, 'Mi PC')).rejects.toThrow('API no disponible')
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
    expect(localStorage.getItem('fokus-push-owner')).toBeNull()
  })
  it('desactiva navegador y API sin cambiar preferencias ni pedir permisos', async () => {
    registration.pushManager.getSubscription.mockResolvedValue(subscription)
    await deactivatePush(12)
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
    expect(deletePushSubscription).toHaveBeenCalledWith(12)
    expect(notification.requestPermission).not.toHaveBeenCalled()
  })
  it('cierra sesión sin dejar avisos cuando el servidor está caído', async () => {
    localStorage.setItem('fokus-push-owner', JSON.stringify({ id: 12, user_id: 7 }))
    registration.pushManager.getSubscription.mockResolvedValue(subscription)
    deletePushSubscription.mockRejectedValue(new Error('Offline'))
    await cleanupPushOnLogout()
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
    expect(deletePushSubscription).toHaveBeenCalledWith(12)
    expect(localStorage.getItem('fokus-push-owner')).toBeNull()
  })
  it('cierra avisos visibles de Fokus al cerrar sesión y conserva avisos ajenos', async () => {
    const own = { data: { source: 'fokus' }, close: vi.fn() }, other = { data: {}, close: vi.fn() }
    registration.getNotifications = vi.fn().mockResolvedValue([own, other])
    await cleanupPushOnLogout()
    expect(own.close).toHaveBeenCalledOnce(); expect(other.close).not.toHaveBeenCalled()
  })
  it('revoca el navegador aunque se haya borrado la metadata local', async () => {
    localStorage.setItem('fokus-push-owner', 'invalid-json')
    registration.pushManager.getSubscription.mockResolvedValue(subscription)
    await cleanupPushOnLogout()
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
    expect(deletePushSubscription).not.toHaveBeenCalled()
  })
  it('no permite cerrar sesión dejando activo un dispositivo si ambas bajas fallan', async () => {
    localStorage.setItem('fokus-push-owner', JSON.stringify({ id: 12, user_id: 7 }))
    registration.pushManager.getSubscription.mockResolvedValue(subscription)
    subscription.unsubscribe.mockResolvedValue(false); deletePushSubscription.mockRejectedValue(new Error('Offline'))
    await expect(cleanupPushOnLogout()).rejects.toThrow('cerrar sesión')
    expect(localStorage.getItem('fokus-push-owner')).not.toBeNull()
  })
  it('revoca una suscripción de otra cuenta sin eliminar sus registros con el JWT actual', async () => {
    localStorage.setItem('fokus-push-owner', JSON.stringify({ id: 13, user_id: 8 }))
    registration.pushManager.getSubscription.mockResolvedValue(subscription)
    await cleanupPushOnLogout()
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
    expect(deletePushSubscription).not.toHaveBeenCalled()
  })
  it('no reutiliza una suscripción previamente vinculada a otra cuenta', async () => {
    localStorage.setItem('fokus-push-owner', JSON.stringify({ id: 13, user_id: 8 }))
    registration.pushManager.getSubscription.mockResolvedValue(subscription)
    await activatePush(publicKey, 'Mi PC')
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
    expect(registration.pushManager.subscribe).toHaveBeenCalledOnce()
  })
  it('revoca la suscripción en conflicto incluso cuando se perdió su metadata local', async () => {
    registration.pushManager.getSubscription.mockResolvedValue(subscription)
    savePushSubscription.mockRejectedValue(Object.assign(new Error('Otra cuenta'), { status: 409 }))
    await expect(activatePush(publicKey, 'Mi PC')).rejects.toThrow('Otra cuenta')
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
  })
})
