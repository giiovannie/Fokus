import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationDelivery, NotificationReminder, PushSubscription, sequelize } from '../src/models/index.js'
import { ReminderRepository } from '../src/services/reminderRepository.js'
import { Op } from 'sequelize'
const originalDatabase = sequelize.config.database
beforeEach(() => { sequelize.config.database = 'test_reminder_database' })
afterEach(() => { sequelize.config.database = originalDatabase; vi.restoreAllMocks() })
const repository = new ReminderRepository()
describe('restricciones y concurrencia de persistencia', () => {
  const connection = answers => {
    const query = vi.fn(); for (const answer of answers) query.mockResolvedValueOnce([[answer]])
    const client = { promise: () => ({ query }), destroy: vi.fn() }
    vi.spyOn(sequelize.connectionManager, 'getConnection').mockResolvedValue(client)
    vi.spyOn(sequelize.connectionManager, 'releaseConnection').mockResolvedValue(undefined)
    return { query, client }
  }
  it('adquiere, comprueba y libera un lock por conexi?n', async () => {
    const { query } = connection([{ acquired: 1 }, { owned: 1 }, { released: 1 }])
    expect(await repository.withRunLock(async assert => { await assert(); return 'done' })).toBe('done')
    expect(query.mock.calls.map(call => call[0])).toEqual(['SELECT GET_LOCK(?, 0) AS acquired', 'SELECT IS_USED_LOCK(?) = CONNECTION_ID() AS owned', 'SELECT RELEASE_LOCK(?) AS released'])
  })
  it('no ejecuta cuando otra instancia tiene el lock', async () => {
    connection([{ acquired: 0 }]); const action = vi.fn()
    expect(await repository.withRunLock(action)).toEqual({ skipped: 'busy' }); expect(action).not.toHaveBeenCalled()
  })
  it('detiene un trabajador que perdi? su lock', async () => {
    connection([{ acquired: 1 }, { owned: 0 }, { released: 1 }])
    await expect(repository.withRunLock(assert => assert())).rejects.toThrow('lock lost')
  })
  it('destruye la conexi?n si no puede liberar el lock', async () => {
    const { client } = connection([{ acquired: 1 }, { released: 0 }])
    await expect(repository.withRunLock(async () => 1)).rejects.toThrow('release failed')
    expect(client.destroy).toHaveBeenCalledOnce()
  })
  it('reclama entrega con compare-and-swap persistente y no duplica intentos', async () => {
    const update = vi.spyOn(NotificationDelivery, 'update').mockResolvedValue([1])
    const row = { id: 4, status: 'pending', attempts: 0 }
    expect(await repository.claimDelivery(row, 1000)).toBe(true)
    expect(update.mock.calls[0][1].where).toMatchObject({ id: 4, status: 'pending', attempts: 0 })
    expect(row).toMatchObject({ status: 'processing', attempts: 1 })
    update.mockResolvedValue([0]); expect(await repository.claimDelivery(row, 1000)).toBe(false)
  })
  it('no revive entregas ya enviadas cuando se renueva la suscripci?n', async () => {
    const update = vi.fn(), sent = { status: 'sent', update }
    vi.spyOn(NotificationDelivery, 'findOrCreate').mockResolvedValue([sent])
    expect(await repository.deliveryFor({ id: 1 }, { id: 2, device_id: 'same-device' }, 1000)).toBe(sent)
    expect(update).not.toHaveBeenCalled()
  })
  it('no elimina un endpoint renovado al caducar el anterior', async () => {
    const destroy = vi.spyOn(PushSubscription, 'destroy').mockResolvedValue(0)
    await repository.expireSubscription({ id: 1, user_id: 7, endpoint_hash: 'old-hash' })
    expect(destroy).toHaveBeenCalledWith({ where: { id: 1, user_id: 7, endpoint_hash: 'old-hash' } })
  })
  it('rota trabajos vencidos para no bloquear otros detr?s de reintentos', async () => {
    const state = { cursor: 9, update: vi.fn() }
    vi.spyOn(repository, 'cursor').mockResolvedValue(state)
    const find = vi.spyOn(NotificationReminder, 'findAll').mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 1 }])
    expect(await repository.dueReminders(1000, 25)).toEqual([{ id: 1 }])
    expect(state.update).toHaveBeenCalledWith({ cursor: 0 })
    expect(find.mock.calls[0][0].where.id[Op.gt]).toBe(9)
  })
})
