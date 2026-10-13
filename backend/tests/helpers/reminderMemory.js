import { notificationDefaults } from '../../src/config/notificationPreferences.js'
const copy = value => structuredClone(value)
const ms = value => new Date(value).getTime()
export class ReminderMemory {
  constructor() {
    this.users = [{ ...notificationDefaults, user_id: 7, enabled: true, exams_enabled: true, tasks_enabled: true }]
    this.events = [{ id: 1, title: 'Parcial real', exam_date: '2026-10-12', exam_time: '09:00', subject: { user_id: 7, name: 'Matemática real' }, type: 'exam' }]
    this.rules = [{ id: 1, user_id: 7, event_type: 'exam', offset_minutes: 60, enabled: true }]
    this.phrases = []
    this.devices = [{ id: 1, user_id: 7, device_id: 'device-a', endpoint_hash: 'hash-a' }]
    this.jobs = []; this.records = []; this.locked = false
  }
  async withRunLock(action) {
    if (this.locked) return { skipped: 'busy' }
    this.locked = true
    try { return await action(async () => { if (!this.locked) throw new Error('Lost lock') }) }
    finally { this.locked = false }
  }
  async recoverInterrupted(limit) { for (const row of this.records.filter(row => row.status === 'processing').slice(0, limit)) Object.assign(row, { status: 'failed', last_error_code: 'delivery_uncertain' }) }
  async nextUsers(limit) { return copy(this.users.slice(0, limit)) }
  async advanceUser() {}
  async nextEvents(user, type, timezone, now, limit) { return copy(this.events.filter(row => (row.user_id ?? row.subject?.user_id) === user && row.type === type).slice(0, limit)) }
  async advanceEvent() {}
  async snapshot(user, type, id) { return copy({ event: this.events.find(row => row.id === id && row.type === type && (row.user_id ?? row.subject?.user_id) === user), preferences: this.users.find(row => row.user_id === user) || notificationDefaults, rules: this.rules.filter(row => row.user_id === user && row.event_type === type), phrases: this.phrases.filter(row => row.user_id === user && row.event_type === type) }) }
  async planEvent(user, type, event, plans, source_hash) {
    for (const plan of plans) {
      if (type === 'agenda' && plan.due_at.getTime() <= Date.now()) continue
      let row = this.jobs.find(row => row.user_id === user && row.event_type === type && row.event_id === event.id && row.offset_minutes === plan.offset_minutes)
      if (!row) { row = { id: this.jobs.length + 1, user_id: user, event_type: type, event_id: event.id, offset_minutes: plan.offset_minutes, status: 'pending', last_phrase: null }; this.jobs.push(row) }
      if (['pending', 'cancelled'].includes(row.status)) Object.assign(row, { due_at: plan.due_at, event_at: plan.event_at, source_hash, status: 'pending', cancellation_reason: null })
    }
  }
  async nextReconciliation(limit) { return this.jobs.filter(row => row.status === 'pending').slice(0, limit) }
  async advanceReconciliation() {}
  async dueReminders(now, limit) { return this.jobs.filter(row => row.status === 'pending' && ms(row.due_at) <= now).sort((a,b) => ms(a.due_at)-ms(b.due_at) || a.id-b.id).slice(0,limit) }
  async advanceDelivery() {}
  async cancelMissingDeliveries(id, devices) { for (const record of this.records.filter(row => row.reminder_id === id && row.status === 'pending' && !devices.includes(row.device_id))) Object.assign(record, { status: 'cancelled', last_error_code: 'device_removed' }) }
  async updateReminder(row, values) { Object.assign(row, values) }
  async cancelReminder(row, reason) { Object.assign(row, { status: 'cancelled', cancellation_reason: reason }); for (const delivery of this.records.filter(delivery => delivery.reminder_id === row.id && delivery.status === 'pending')) Object.assign(delivery, { status: 'cancelled', last_error_code: reason }) }
  async group(row) { return this.jobs.filter(other => other.user_id === row.user_id && other.event_type === row.event_type && other.event_id === row.event_id && ms(other.due_at) === ms(row.due_at) && ms(other.event_at) === ms(row.event_at)) }
  async subscriptions(user) { return copy(this.devices.filter(row => row.user_id === user)) }
  async deliveryFor(row, subscription, now) {
    let record = this.records.find(record => record.reminder_id === row.id && record.device_id === subscription.device_id)
    if (!record) { record = { id: this.records.length + 1, reminder_id: row.id, device_id: subscription.device_id, subscription_id: subscription.id, status: 'pending', attempts: 0, next_attempt_at: new Date(now) }; this.records.push(record) }
    if (record.status === 'cancelled') Object.assign(record, { status: 'pending', next_attempt_at: new Date(now), last_error_code: null })
    return record
  }
  async claimDelivery(row) { if (row.status !== 'pending') return false; row.status = 'processing'; row.attempts++; return true }
  async finishDelivery(row, values) { Object.assign(row, values) }
  async deliveries(id) { return this.records.filter(row => row.reminder_id === id) }
  async previousPhrase(row) { return this.jobs.findLast(other => other.user_id === row.user_id && other.event_type === row.event_type && other.status === 'processed' && other.id !== row.id)?.last_phrase }
  async expireSubscription(subscription) { this.devices = this.devices.filter(row => row.id !== subscription.id || row.endpoint_hash !== subscription.endpoint_hash) }
}
