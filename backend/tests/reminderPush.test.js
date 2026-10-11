import { afterEach, describe, expect, it, vi } from 'vitest'
import webPush from 'web-push'
import { deliverReminder } from '../src/services/reminderPush.js'
vi.mock('../src/config/webPush.js', () => ({ getPushConfiguration: () => ({ subject: 'mailto:test@example.test', publicKey: 'test-public', privateKey: 'test-private' }), validatePushSubscription: target => target.endpoint.startsWith('https://') }))
afterEach(() => vi.restoreAllMocks())
const subscription = { endpoint: 'https://push.example.test/device', p256dh: 'public', auth: 'device-key' }
const invoke = () => deliverReminder(subscription, { title: 'Examen', body: 'Materia real' }, { ttl: 60, timeout: 1000, id: 'stable-id' })
describe('transporte autom?tico', () => {
  it('env?a payload real sin claves VAPID y aplica TTL y timeout acotados', async () => {
    const send = vi.spyOn(webPush, 'sendNotification').mockResolvedValue({})
    await invoke()
    const [, payload, options] = send.mock.calls[0]
    expect(JSON.parse(payload)).toEqual({ title: 'Examen', body: 'Materia real', id: 'stable-id', data: { source: 'fokus', test: false } })
    expect(payload).not.toContain('test-private')
    expect(options).toMatchObject({ TTL: 60, timeout: 1000 })
  })
  it.each([[410, true, false, 'subscription_expired'], [404, true, false, 'subscription_expired'], [429, false, true, 'provider_busy'], [503, false, true, 'provider_busy'], [400, false, false, 'provider_rejected'], [undefined, false, false, 'delivery_uncertain']])('clasifica %s sin propagar mensajes sensibles', async (statusCode, expired, retryable, deliveryCode) => {
    vi.spyOn(webPush, 'sendNotification').mockRejectedValue(Object.assign(new Error('sensitive-provider-details'), { statusCode }))
    await expect(invoke()).rejects.toMatchObject({ expired, retryable, deliveryCode, message: 'Push delivery failed' })
  })
})
