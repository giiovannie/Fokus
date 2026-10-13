import { afterEach, describe, expect, it, vi } from 'vitest'
import { Op } from 'sequelize'
import { NotificationDelivery } from '../src/models/index.js'
import { assertSubscriptionNotExpired, recoverExpiredPushDeliveries } from '../src/services/pushSubscriptionRecovery.js'
import { subscriptionHash } from '../src/services/reminderRepository.js'
import { workerLimits } from '../src/config/reminderWorker.js'
import { processReminderBatch } from '../src/services/reminderProcessor.js'
import { ReminderMemory } from './helpers/reminderMemory.js'

const subscription = { id: 12, user_id: 7, device_id: 'device-a', endpoint: 'https://fcm.googleapis.com/new', p256dh: 'new-key', auth: 'new-auth' }
const transaction = { LOCK: { UPDATE: 'UPDATE' } }
const now = new Date('2026-10-12T22:14:00Z')
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('recuperación segura tras renovar Web Push', () => {
  it.each([true, false])('recupera sin duplicados y revalida enabled=%s en el worker', async enabled => {
    vi.useFakeTimers(); vi.setSystemTime('2026-10-12T11:00:00Z')
    const repository = new ReminderMemory()
    const send = vi.fn().mockRejectedValueOnce(Object.assign(new Error('Gone'), { expired: true, deliveryCode: 'subscription_expired' })).mockResolvedValue(undefined)
    await processReminderBatch({ repository, send })
    expect(repository.records[0]).toMatchObject({ status: 'failed', attempts: 1, last_error_code: 'subscription_expired' })
    expect(repository.devices).toHaveLength(0)
    const record = repository.records[0], reminder = repository.jobs[0]
    // El repositorio en memoria no emula la FK SET NULL de MySQL.
    record.subscription_id = null
    record.update = async values => Object.assign(record, values)
    reminder.update = async values => Object.assign(reminder, values)
    vi.spyOn(NotificationDelivery, 'findAll').mockResolvedValue([{ update: record.update, reminder }])
    vi.setSystemTime('2026-10-12T11:01:00Z')
    const renewed = { ...subscription, id: 2 }
    repository.devices.push(renewed)
    await recoverExpiredPushDeliveries(renewed, transaction, new Date())
    repository.users[0].enabled = enabled
    await processReminderBatch({ repository, send })
    await processReminderBatch({ repository, send })
    if (!enabled) {
      expect(send).toHaveBeenCalledOnce() // Solo el rechazo previo: no enviar tras desactivar.
      expect(record).toMatchObject({ status: 'cancelled', attempts: 1 })
      expect(reminder.status).toBe('cancelled')
      return
    }
    expect(send).toHaveBeenCalledTimes(2) // Un rechazo y una aceptación; ningún duplicado.
    expect(send.mock.calls[1][0]).toMatchObject({ id: 2, user_id: 7, device_id: 'device-a' })
    expect(record).toMatchObject({ status: 'sent', attempts: 2, subscription_id: 2 })
    expect(reminder.status).toBe('processed')
  })
  it('rechaza volver a registrar la misma suscripción rechazada, incluso sin su FK', async () => {
    const query = vi.spyOn(NotificationDelivery, 'findOne').mockResolvedValue({ id: 20, subscription_id: null })
    await expect(assertSubscriptionNotExpired(subscription, transaction)).rejects.toMatchObject({ status: 410 })
    expect(query.mock.calls[0][0].where).toEqual({ device_id: 'device-a', subscription_hash: subscriptionHash(subscription), last_error_code: 'subscription_expired' })
    expect(query.mock.calls[0][0].include[0].where).toEqual({ user_id: 7 })
  })

  it('reanuda una entrega rechazada conservando intentos y usando la suscripción nueva', async () => {
    const delivery = { update: vi.fn(), reminder: { update: vi.fn() } }
    const query = vi.spyOn(NotificationDelivery, 'findAll').mockResolvedValue([delivery])
    await recoverExpiredPushDeliveries(subscription, transaction, now)
    expect(delivery.update).toHaveBeenCalledWith({ subscription_id: 12, subscription_hash: subscriptionHash(subscription), status: 'pending', last_error_code: null, next_attempt_at: now }, { transaction })
    expect(delivery.update.mock.calls[0][0]).not.toHaveProperty('attempts')
    expect(delivery.reminder.update).toHaveBeenCalledWith({ status: 'pending', cancellation_reason: null }, { transaction })
    const options = query.mock.calls[0][0]
    expect(options.where).toEqual({ device_id: 'device-a', status: 'failed', last_error_code: 'subscription_expired', subscription_hash: { [Op.ne]: subscriptionHash(subscription) }, attempts: { [Op.lt]: workerLimits.maxAttempts } })
    expect(options.include[0].where).toEqual({ user_id: 7, status: { [Op.in]: ['pending', 'failed', 'processed'] }, due_at: { [Op.between]: [new Date(now.getTime() - workerLimits.catchUpMs), now] }, event_at: { [Op.gt]: now } })
    expect(options).toMatchObject({ transaction, lock: 'UPDATE', limit: workerLimits.deliveries })
  })

  it.each([
    { status: 'sent' }, { last_error_code: 'delivery_uncertain' }, { device_id: 'other-device' },
    { subscription_hash: subscriptionHash(subscription) }, { attempts: workerLimits.maxAttempts },
    { user_id: 8 }, { due_at: new Date(now.getTime() - workerLimits.catchUpMs - 1) },
    { due_at: new Date(now.getTime() + 1) }, { event_at: now }, { reminder_status: 'cancelled' },
  ])('excluye una entrega no recuperable: %j', async override => {
    const row = { device_id: 'device-a', status: 'failed', last_error_code: 'subscription_expired', subscription_hash: 'old-hash', attempts: 1, user_id: 7, due_at: new Date(now.getTime() - 60000), event_at: new Date(now.getTime() + 3600000), reminder_status: 'failed', ...override }
    const update = vi.fn()
    vi.spyOn(NotificationDelivery, 'findAll').mockImplementation(async options => {
      const w = options.where, r = options.include[0].where
      const eligible = row.device_id === w.device_id && row.status === w.status && row.last_error_code === w.last_error_code && row.subscription_hash !== w.subscription_hash[Op.ne] && row.attempts < w.attempts[Op.lt] && row.user_id === r.user_id && r.status[Op.in].includes(row.reminder_status) && row.due_at >= r.due_at[Op.between][0] && row.due_at <= r.due_at[Op.between][1] && row.event_at > r.event_at[Op.gt]
      return eligible ? [{ update, reminder: { update } }] : []
    })
    await recoverExpiredPushDeliveries(subscription, transaction, now)
    expect(update).not.toHaveBeenCalled()
  })
})
