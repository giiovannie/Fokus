import { createHash } from 'node:crypto'
import { calculateReminders, eventHasExpired, postponeSilence } from './reminderTime.js'
import { buildNotificationMessage, notificationTemplates } from '../utils/notificationMessages.js'
import { workerLimits } from '../config/reminderWorker.js'
const milliseconds = date => new Date(date).getTime()
const fingerprint = snapshot => createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
const currentPlan = (row, snapshot) => snapshot.event && calculateReminders({ ...snapshot, eventType: row.event_type }).find(plan => plan.offset_minutes === row.offset_minutes)

export const processReminderBatch = async ({ repository, send, clock = Date.now, limits = workerLimits }) => repository.withRunLock(async assertOwned => {
  const started = clock(), deadline = started + limits.durationMs
  const report = { plannedEvents: 0, reconciled: 0, sent: 0, retried: 0, failed: 0, cancelled: 0, deliveriesAttempted: 0 }
  const timeAvailable = () => clock() < deadline
  const refresh = async row => {
    const snapshot = await repository.snapshot(row.user_id, row.event_type, row.event_id)
    let plan
    try { plan = currentPlan(row, snapshot) } catch { await repository.cancelReminder(row, 'invalid_configuration'); return null }
    if (!plan || eventHasExpired(row.event_type, milliseconds(plan.event_at), clock())) {
      await repository.cancelReminder(row, snapshot.event ? 'disabled_or_expired' : 'event_deleted'); report.cancelled++; return null
    }
    const due = milliseconds(plan.due_at)
    if (due < clock() - limits.catchUpMs) { await repository.cancelReminder(row, 'missed_window'); report.cancelled++; return null }
    await repository.updateReminder(row, { due_at: plan.due_at, event_at: plan.event_at, source_hash: fingerprint(snapshot) })
    return { snapshot, plan }
  }
  await assertOwned()
  // Con el lock exclusivo disponible, processing de una ejecución previa es incierto.
  await repository.recoverInterrupted(limits.deliveries)
  let remindersVisited = 0
  const deliverDue = async () => {
    if (remindersVisited >= limits.reminders) return
    for (const row of await repository.dueReminders(clock(), limits.reminders - remindersVisited)) {
      if (!timeAvailable() || report.deliveriesAttempted >= limits.deliveries) break
      remindersVisited++
      await assertOwned()
      await repository.advanceDelivery(row.id)
      let current = await refresh(row)
      if (!current || milliseconds(row.due_at) > clock()) continue
      const group = await repository.group(row)
      const siblings = []
      for (const other of group) {
        if (other.id === row.id) {
          const attempted = (await repository.deliveries(row.id)).some(delivery => ['sent', 'processing'].includes(delivery.status) || delivery.last_error_code === 'delivery_uncertain')
          siblings.push({ ...row, consumed: attempted }); continue
        }
        const attempted = (await repository.deliveries(other.id)).some(delivery => ['sent', 'processing'].includes(delivery.status) || delivery.last_error_code === 'delivery_uncertain')
        if (attempted) { siblings.push({ ...other, consumed: true }); continue }
        if (other.status !== 'pending') continue
        const fresh = await refresh(other)
        if (fresh && milliseconds(other.due_at) === milliseconds(row.due_at)) siblings.push(other)
      }
      siblings.sort((a, b) => Number(!!b.consumed) - Number(!!a.consumed) || a.id - b.id)
      const leader = siblings[0]
      if (leader && leader.id !== row.id) { await repository.cancelReminder(row, 'merged'); report.cancelled++; continue }
      const subscriptions = await repository.subscriptions(row.user_id)
      if (!subscriptions.length) continue
      for (const subscription of subscriptions) {
        if (!timeAvailable() || report.deliveriesAttempted >= limits.deliveries) break
        await assertOwned()
        // Releer fecha/reglas/consentimiento justo antes de cada intento.
        current = await refresh(row)
        if (!current || milliseconds(row.due_at) > clock()) break
        if (postponeSilence(clock(), current.snapshot.preferences) > clock()) continue
        const owned = (await repository.subscriptions(row.user_id)).find(candidate => candidate.id === subscription.id && candidate.device_id === subscription.device_id)
        if (!owned) continue
        const delivery = await repository.deliveryFor(row, owned, clock())
        if (delivery.status !== 'pending' || delivery.attempts >= limits.maxAttempts || milliseconds(delivery.next_attempt_at) > clock()) continue
        const { event, preferences, phrases } = current.snapshot
        let style = preferences[row.event_type + '_style']
        if (style === 'unfiltered' && !preferences.unfiltered_enabled || style === 'custom' && !phrases.length) style = 'formal'
        const candidates = style === 'custom' ? phrases.map(phrase => phrase.content) : notificationTemplates[row.event_type][style]
        const selectedText = candidates?.includes(row.last_phrase) ? row.last_phrase : undefined
        const message = buildNotificationMessage({ eventType: row.event_type, style, phrases, selectedText,
          previousText: await repository.previousPhrase(row), unfilteredEnabled: preferences.unfiltered_enabled,
          event: { title: event.title, subject: event.subject.name, ...current.plan.effective } })
        await repository.updateReminder(row, { last_phrase: message.phrase })
        if (!await repository.claimDelivery(delivery, clock())) continue
        if (eventHasExpired(row.event_type, milliseconds(row.event_at), clock())) {
          await repository.finishDelivery(delivery, { status: 'cancelled', last_error_code: 'event_expired' })
          await repository.cancelReminder(row, 'event_expired'); report.cancelled++; break
        }
        if (!timeAvailable()) {
          await repository.finishDelivery(delivery, { status: 'pending', attempts: delivery.attempts - 1 }); break
        }
        report.deliveriesAttempted++
        try {
          await assertOwned()
          await send(owned, message, { id: 'reminder-' + row.id + '-' + delivery.id, ttl: Math.max(0, Math.min(300, Math.floor((milliseconds(row.event_at) - clock()) / 1000))), timeout: Math.max(1, Math.min(10000, deadline - clock())) })
          await repository.finishDelivery(delivery, { status: 'sent', sent_at: new Date(clock()), last_error_code: null }); report.sent++
        } catch (error) {
          if (error.expired) await repository.expireSubscription(owned)
          const retry = error.retryable === true && delivery.attempts < limits.maxAttempts
          let next = clock() + (delivery.attempts === 1 ? 60000 : 300000)
          next = postponeSilence(next, current.snapshot.preferences)
          const canRetry = retry && !eventHasExpired(row.event_type, milliseconds(row.event_at), next) && next <= milliseconds(row.due_at) + limits.catchUpMs
          const code = ['subscription_expired', 'provider_busy', 'provider_rejected', 'delivery_uncertain', 'push_unconfigured', 'invalid_subscription'].includes(error.deliveryCode) ? error.deliveryCode : 'delivery_uncertain'
          await repository.finishDelivery(delivery, { status: canRetry ? 'pending' : 'failed', next_attempt_at: new Date(next), last_error_code: code })
          if (canRetry) report.retried++; else report.failed++
        }
      }
      if (row.status !== 'pending') continue
      const currentDevices = await repository.subscriptions(row.user_id)
      await repository.cancelMissingDeliveries(row.id, currentDevices.map(subscription => subscription.device_id))
      const deliveries = await repository.deliveries(row.id)
      if (currentDevices.some(subscription => !deliveries.some(delivery => delivery.device_id === subscription.device_id))) continue
      if (deliveries.length && deliveries.every(delivery => ['sent', 'failed', 'cancelled'].includes(delivery.status))) {
        await repository.updateReminder(row, { status: deliveries.some(delivery => delivery.status === 'sent') ? 'processed' : 'failed' })
      }
    }
  }
  // Los pendientes ya programados tienen prioridad sobre el trabajo de planificación.
  if (timeAvailable()) await deliverDue()
  const usersToPlan = timeAvailable() ? await repository.nextUsers(limits.users) : []
  for (const preferences of usersToPlan) {
    if (!timeAvailable()) break
    await repository.advanceUser(preferences.user_id)
    if (!preferences.enabled) continue
    for (const type of ['exam', 'task']) {
      if (!preferences[type === 'exam' ? 'exams_enabled' : 'tasks_enabled']) continue
      for (const event of await repository.nextEvents(preferences.user_id, type, preferences.timezone, clock(), limits.eventsPerType)) {
        if (!timeAvailable()) break
        await assertOwned()
        const snapshot = await repository.snapshot(preferences.user_id, type, event.id)
        if (snapshot.event) {
          let plans
          try { plans = calculateReminders({ ...snapshot, eventType: type }).filter(plan => !eventHasExpired(type, milliseconds(plan.event_at), clock()) && milliseconds(plan.due_at) >= clock() - limits.catchUpMs) }
          catch { plans = [] }
          await repository.planEvent(preferences.user_id, type, snapshot.event, plans, fingerprint(snapshot))
          report.plannedEvents++
        }
        await repository.advanceEvent(preferences.user_id, type, event.id)
      }
    }
  }
  // Los nuevos avisos vencidos también pueden salir en este lote si queda presupuesto.
  if (timeAvailable() && report.deliveriesAttempted < limits.deliveries) await deliverDue()
  const pendingToReconcile = timeAvailable() ? await repository.nextReconciliation(limits.reminders) : []
  for (const row of pendingToReconcile) {
    if (!timeAvailable()) break
    await assertOwned(); await refresh(row); await repository.advanceReconciliation(row.id); report.reconciled++
  }
  return report
})
