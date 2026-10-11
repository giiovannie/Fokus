import { createHash } from 'node:crypto'
import { Op } from 'sequelize'
import { NotificationPreference, NotificationRule, NotificationPhrase, NotificationReminder, NotificationDelivery, NotificationWorkerState, PushSubscription, Exam, Task, Subject, sequelize } from '../models/index.js'
import { withUserLock } from '../utils/withUserLock.js'
import { localPlanningDates } from './reminderTime.js'
import { notificationDefaults } from '../config/notificationPreferences.js'
const plain = row => row?.get ? row.get({ plain: true }) : row
export const subscriptionHash = row => createHash('sha256').update(JSON.stringify([row.endpoint, row.p256dh, row.auth])).digest('hex')

export class ReminderRepository {
  async withRunLock(action) {
    const lock = 'fokus-reminders-' + createHash('sha256').update(sequelize.config.database).digest('hex').slice(0, 40)
    const connection = await sequelize.connectionManager.getConnection({ type: 'WRITE' })
    const client = connection.promise()
    let acquired = false
    const assertOwned = async () => {
      const [rows] = await client.query('SELECT IS_USED_LOCK(?) = CONNECTION_ID() AS owned', [lock])
      if (Number(rows[0].owned) !== 1) throw new Error('Reminder lock lost')
    }
    let result, failure
    try {
      const [rows] = await client.query('SELECT GET_LOCK(?, 0) AS acquired', [lock])
      acquired = Number(rows[0].acquired) === 1
      result = acquired ? await action(assertOwned) : { skipped: 'busy' }
    } catch (error) { failure = error }
    try {
      if (acquired) {
        const [rows] = await client.query('SELECT RELEASE_LOCK(?) AS released', [lock])
        if (Number(rows[0].released) !== 1) throw new Error('Reminder lock release failed')
      }
    } catch (error) { connection.destroy(); failure ??= error }
    try { await sequelize.connectionManager.releaseConnection(connection) }
    catch (error) { failure ??= error }
    if (failure) throw failure
    return result
  }
  async recoverInterrupted(limit) {
    const rows = await NotificationDelivery.findAll({ where: { status: 'processing' }, order: [['id', 'ASC']], limit })
    for (const row of rows) await row.update({ status: 'failed', last_error_code: 'delivery_uncertain' })
  }
  async cursor(scope) {
    const [row] = await NotificationWorkerState.findOrCreate({ where: { scope } })
    return row
  }
  async nextUsers(limit) {
    const state = await this.cursor('users')
    const load = cursor => NotificationPreference.findAll({ where: { user_id: { [Op.gt]: cursor } }, order: [['user_id', 'ASC']], limit })
    let rows = await load(state.cursor)
    if (!rows.length && state.cursor) { await state.update({ cursor: 0 }); rows = await load(0) }
    return rows.map(plain)
  }
  async advanceUser(userId) { await (await this.cursor('users')).update({ cursor: userId }) }
  async nextEvents(userId, type, timezone, now, limit) {
    const state = await this.cursor('events:' + userId + ':' + type)
    const model = type === 'exam' ? Exam : Task
    const dates = localPlanningDates(now, timezone)
    const load = cursor => model.findAll({ where: { id: { [Op.gt]: cursor }, [type === 'exam' ? 'exam_date' : 'due_date']: { [Op.between]: dates } },
      include: [{ model: Subject, as: 'subject', where: { user_id: userId }, attributes: ['name', 'user_id'] }], order: [['id', 'ASC']], limit })
    let rows = await load(state.cursor)
    if (!rows.length && state.cursor) { await state.update({ cursor: 0 }); rows = await load(0) }
    return rows.map(plain)
  }
  async advanceEvent(userId, type, id) { await (await this.cursor('events:' + userId + ':' + type)).update({ cursor: id }) }
  async snapshot(userId, type, eventId) {
    const model = type === 'exam' ? Exam : Task
    const [event, preferences, rules, phrases] = await Promise.all([
      model.findOne({ where: { id: eventId }, include: [{ model: Subject, as: 'subject', where: { user_id: userId }, attributes: ['name', 'user_id'] }] }),
      NotificationPreference.findOne({ where: { user_id: userId } }),
      NotificationRule.findAll({ where: { user_id: userId, event_type: type } }),
      NotificationPhrase.findAll({ where: { user_id: userId, event_type: type } }),
    ])
    return { event: plain(event), preferences: { ...notificationDefaults, ...plain(preferences) }, rules: rules.map(plain), phrases: phrases.map(plain) }
  }
  async planEvent(userId, type, event, plans, sourceHash) {
    return withUserLock(userId, async transaction => {
      for (const plan of plans) {
        const identity = { user_id: userId, event_type: type, event_id: event.id, offset_minutes: plan.offset_minutes }
        const [row] = await NotificationReminder.findOrCreate({ where: identity, defaults: { due_at: plan.due_at, event_at: plan.event_at, source_hash: sourceHash }, transaction })
        if (['pending', 'cancelled'].includes(row.status)) await row.update({ due_at: plan.due_at, event_at: plan.event_at, source_hash: sourceHash, status: 'pending', cancellation_reason: null }, { transaction })
      }
    })
  }
  async nextReconciliation(limit) {
    const state = await this.cursor('reconciliation')
    const load = cursor => NotificationReminder.findAll({ where: { id: { [Op.gt]: cursor }, status: 'pending' }, order: [['id', 'ASC']], limit })
    let rows = await load(state.cursor)
    if (!rows.length && state.cursor) { await state.update({ cursor: 0 }); rows = await load(0) }
    return rows.map(plain)
  }
  async advanceReconciliation(id) { await (await this.cursor('reconciliation')).update({ cursor: id }) }
  async dueReminders(now, limit) {
    const state = await this.cursor('delivery')
    const load = cursor => NotificationReminder.findAll({ where: { id: { [Op.gt]: cursor }, status: 'pending', due_at: { [Op.lte]: new Date(now) } }, order: [['id', 'ASC']], limit })
    let rows = await load(state.cursor)
    if (!rows.length && state.cursor) { await state.update({ cursor: 0 }); rows = await load(0) }
    return rows.map(plain)
  }
  async advanceDelivery(id) { await (await this.cursor('delivery')).update({ cursor: id }) }
  async cancelMissingDeliveries(reminderId, devices) {
    const where = { reminder_id: reminderId, status: 'pending' }
    if (devices.length) where.device_id = { [Op.notIn]: devices }
    await NotificationDelivery.update({ status: 'cancelled', last_error_code: 'device_removed' }, { where })
  }
  async updateReminder(row, values) {
    await NotificationReminder.update(values, { where: { id: row.id, status: { [Op.in]: ['pending', 'cancelled'] } } })
    Object.assign(row, values)
  }
  async cancelReminder(row, reason) {
    await this.updateReminder(row, { status: 'cancelled', cancellation_reason: reason })
    await NotificationDelivery.update({ status: 'cancelled', last_error_code: reason }, { where: { reminder_id: row.id, status: 'pending' } })
  }
  async group(row) {
    return (await NotificationReminder.findAll({ where: { user_id: row.user_id, event_type: row.event_type, event_id: row.event_id, due_at: row.due_at, event_at: row.event_at }, order: [['id', 'ASC']] })).map(plain)
  }
  async subscriptions(userId) { return (await PushSubscription.findAll({ where: { user_id: userId }, order: [['id', 'ASC']], limit: 10 })).map(plain) }
  async deliveryFor(row, subscription, now) {
    const hash = subscriptionHash(subscription)
    const [delivery] = await NotificationDelivery.findOrCreate({ where: { reminder_id: row.id, device_id: subscription.device_id }, defaults: { subscription_id: subscription.id, subscription_hash: hash, next_attempt_at: new Date(now) } })
    if (['pending', 'cancelled'].includes(delivery.status)) await delivery.update({ subscription_id: subscription.id, subscription_hash: hash, status: 'pending', last_error_code: delivery.status === 'cancelled' ? null : delivery.last_error_code, next_attempt_at: delivery.status === 'cancelled' ? new Date(now) : delivery.next_attempt_at })
    return plain(delivery)
  }
  async claimDelivery(row, now) {
    const [changed] = await NotificationDelivery.update({ status: 'processing', attempted_at: new Date(now), attempts: row.attempts + 1 }, { where: { id: row.id, status: 'pending', attempts: row.attempts, next_attempt_at: { [Op.lte]: new Date(now) } } })
    if (changed) Object.assign(row, { status: 'processing', attempts: row.attempts + 1 })
    return changed === 1
  }
  async finishDelivery(row, values) {
    await NotificationDelivery.update(values, { where: { id: row.id, status: 'processing' } })
    Object.assign(row, values)
  }
  async deliveries(reminderId) { return (await NotificationDelivery.findAll({ where: { reminder_id: reminderId }, order: [['id', 'ASC']] })).map(plain) }
  async previousPhrase(row) {
    const previous = await NotificationReminder.findOne({ where: { user_id: row.user_id, event_type: row.event_type, status: 'processed', id: { [Op.ne]: row.id } }, order: [['updated_at', 'DESC']] })
    return previous?.last_phrase
  }
  async expireSubscription(subscription) { await PushSubscription.destroy({ where: { id: subscription.id, user_id: subscription.user_id, endpoint_hash: subscription.endpoint_hash } }) }
}
