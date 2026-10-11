import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendLocalNotification } from './localNotifications.js'
const message = { title: 'Fokus · Notificación de prueba', body: '[PRUEBA] Datos del evento' }
afterEach(() => vi.useRealTimers())
describe('prueba local de notificaciones', () => {
  it('solicita permiso desde el botón y utiliza worker activo sin registrar Push', async () => {
    const notification = { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') }
    const showNotification = vi.fn().mockResolvedValue(undefined)
    const registration = { active: {}, showNotification }
    const serviceWorker = { getRegistration: vi.fn().mockResolvedValue(registration) }
    await sendLocalNotification(message, { notification, serviceWorker, secure: true })
    expect(notification.requestPermission).toHaveBeenCalledOnce()
    expect(showNotification).toHaveBeenCalledWith(message.title, expect.objectContaining({ body: message.body, icon: '/icons/fokus-192.png', data: { test: true, url: '/notifications/preferences' } }))
  })
  it('permite repetir pruebas sin solicitar permiso nuevamente', async () => {
    const notification = { permission: 'granted', requestPermission: vi.fn() }
    const showNotification = vi.fn()
    const serviceWorker = { getRegistration: async () => ({ active: {}, showNotification }) }
    await sendLocalNotification(message, { notification, serviceWorker, secure: true })
    await sendLocalNotification({ ...message, body: 'Otra personalidad' }, { notification, serviceWorker, secure: true })
    expect(showNotification).toHaveBeenCalledTimes(2); expect(notification.requestPermission).not.toHaveBeenCalled()
  })
  it.each(['denied', 'default'])('explica permiso rechazado %s sin intentar enviar', async permission => {
    const notification = { permission, requestPermission: vi.fn().mockResolvedValue('denied') }
    const serviceWorker = { getRegistration: vi.fn() }
    await expect(sendLocalNotification(message, { notification, serviceWorker, secure: true })).rejects.toThrow('bloqueadas')
    expect(serviceWorker.getRegistration).not.toHaveBeenCalled()
  })
  it('explica falta de soporte y contexto inseguro', async () => {
    await expect(sendLocalNotification(message, { notification: null, secure: true })).rejects.toThrow('no admite')
    await expect(sendLocalNotification(message, { secure: false })).rejects.toThrow('segura')
  })
  it('usa constructor desktop sin worker y espera confirmación', async () => {
    let instance
    class NotificationMock { static permission = 'granted'; constructor() { instance = this } }
    const pending = sendLocalNotification(message, { notification: NotificationMock, serviceWorker: null, secure: true })
    await Promise.resolve(); instance.onshow()
    await expect(pending).resolves.toBeUndefined()
  })
  it('explica fallos de worker y constructor móvil', async () => {
    await expect(sendLocalNotification(message, { notification: { permission: 'granted' }, serviceWorker: { getRegistration: async () => ({ active: {}, showNotification: async () => { throw new Error('Aviso rechazado') } }) }, secure: true })).rejects.toThrow('No pudimos mostrar')
    class MobileNotification { static permission = 'granted'; constructor() { throw new Error('No disponible en este dispositivo') } }
    await expect(sendLocalNotification(message, { notification: MobileNotification, serviceWorker: null, secure: true })).rejects.toThrow('dispositivo')
  })
  it('informa rechazo del constructor y no confirma un aviso que nunca se muestra', async () => {
    vi.useFakeTimers()
    let instance
    class NotificationMock { static permission = 'granted'; constructor() { instance = this } }
    const failed = sendLocalNotification(message, { notification: NotificationMock, serviceWorker: null, secure: true })
    const assertion = expect(failed).rejects.toThrow('No pudimos mostrar')
    await Promise.resolve(); instance.onerror(); await assertion
    const pending = sendLocalNotification(message, { notification: NotificationMock, serviceWorker: null, secure: true })
    const timeout = expect(pending).rejects.toThrow('No pudimos mostrar')
    await vi.advanceTimersByTimeAsync(5000); await timeout
  })

})
