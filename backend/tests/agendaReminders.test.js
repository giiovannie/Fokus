import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ReminderMemory } from './helpers/reminderMemory.js'
import { processReminderBatch } from '../src/services/reminderProcessor.js'
import { calculateReminders, eventHasExpired } from '../src/services/reminderTime.js'
import { workerLimits } from '../src/config/reminderWorker.js'
let repository, send
const run = options => processReminderBatch({ repository, send, ...options })
const agenda = overrides => ({ id: 2, user_id: 7, type: 'agenda', title: 'Consulta personal', event_date: '2026-10-13', event_time: '00:05', reminder_minutes: 0, ...overrides })
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime('2026-10-13T02:50:00Z')
  repository = new ReminderMemory(); repository.events = [agenda()]; repository.rules = []
  repository.users[0].exams_enabled = false; repository.users[0].tasks_enabled = false
  send = vi.fn().mockResolvedValue(undefined)
})
afterEach(() => vi.useRealTimers())
it('entrega al comenzar tras QStash, cerca de medianoche, con TTL positivo y sin duplicados', async () => {
  await run(); expect(repository.jobs).toHaveLength(1)
  expect(repository.jobs[0].due_at.toISOString()).toBe('2026-10-13T03:05:00.000Z')
  vi.setSystemTime('2026-10-13T03:07:00Z')
  const report = await run(); expect(report.sent).toBe(1); expect(send).toHaveBeenCalledOnce()
  expect(send.mock.calls[0][1].body).toContain('00:05'); expect(send.mock.calls[0][1].body).toContain('Consulta personal')
  expect(send.mock.calls[0][2].ttl).toBe(300)
  expect(repository.records[0]).toMatchObject({ status: 'sent', attempts: 1, subscription_id: 1 })
  expect(repository.jobs[0].status).toBe('processed')
  await run(); expect(send).toHaveBeenCalledOnce()
})
it('no envía actividades de otras cuentas, sin hora, sin aviso ni retroactivas', async () => {
  repository.events = [agenda({ user_id: 8 }), agenda({ id: 3, event_time: null }), agenda({ id: 4, reminder_minutes: null }), agenda({ id: 5, event_time: '00:01' })]
  vi.setSystemTime('2026-10-13T03:02:00Z'); await run()
  expect(repository.jobs).toHaveLength(0); expect(send).not.toHaveBeenCalled()
})
it('cancela cambios a día completo y eventos eliminados antes de entregar', async () => {
  await run(); repository.events[0].event_time = null
  vi.setSystemTime('2026-10-13T03:07:00Z'); await run()
  expect(repository.jobs[0].status).toBe('cancelled'); expect(send).not.toHaveBeenCalled()
  repository.events = []; await run(); expect(send).not.toHaveBeenCalled()
})
it('respeta silencio y desactivación global sin depender de reglas de tareas', async () => {
  repository.users[0].quiet_hours_enabled = true; repository.users[0].quiet_start = '23:00'; repository.users[0].quiet_end = '07:00'
  await run(); expect(repository.jobs).toHaveLength(0)
  repository.users[0].quiet_hours_enabled = false; await run(); expect(repository.jobs).toHaveLength(1)
  repository.users[0].enabled = false; vi.setSystemTime('2026-10-13T03:07:00Z'); await run()
  expect(repository.jobs[0].status).toBe('cancelled'); expect(send).not.toHaveBeenCalled()
})
it('pierde la ventana de 15 minutos sin enviar un aviso atrasado', async () => {
  await run(); vi.setSystemTime('2026-10-13T03:21:00Z'); await run()
  expect(repository.jobs[0].status).toBe('cancelled'); expect(send).not.toHaveBeenCalled()
  expect(eventHasExpired('agenda', Date.parse('2026-10-13T03:05:00Z'), Date.now())).toBe(true)
})
it('registra missed_window si venció el aviso anticipado pero el evento sigue siendo futuro', async () => {
  repository.events = [agenda({ event_time: '01:05', reminder_minutes: 60 })]
  await run(); vi.setSystemTime('2026-10-13T03:21:00Z'); await run()
  expect(repository.jobs[0].cancellation_reason).toBe('missed_window'); expect(send).not.toHaveBeenCalled()
})
it('reintenta errores transitorios dentro de la ventana con el mismo ledger', async () => {
  await run(); send.mockRejectedValueOnce({ deliveryCode: 'provider_busy', retryable: true })
  vi.setSystemTime('2026-10-13T03:07:00Z'); expect((await run()).retried).toBe(1)
  vi.setSystemTime('2026-10-13T03:08:00Z'); expect((await run()).sent).toBe(1)
  expect(repository.records).toHaveLength(1); expect(repository.records[0].attempts).toBe(2)
})
it('mantiene pendientes sin suscripción y entrega si se recupera a tiempo', async () => {
  await run(); repository.devices = []
  vi.setSystemTime('2026-10-13T03:07:00Z'); await run(); expect(repository.jobs[0].status).toBe('pending')
  expect(repository.records).toHaveLength(0)
  repository.devices = [{ id: 2, user_id: 7, device_id: 'renewed', endpoint_hash: 'new' }]
  vi.setSystemTime('2026-10-13T03:09:00Z'); await run(); expect(repository.records[0].status).toBe('sent')
})
it('entrega antes de planificar y mantiene el presupuesto global de 20 segundos', async () => {
  await run(); vi.setSystemTime('2026-10-13T03:07:00Z')
  vi.spyOn(repository, 'nextEvents').mockImplementation(async () => { vi.setSystemTime(Date.now() + workerLimits.durationMs + 1); return [] })
  expect((await run()).sent).toBe(1); expect(repository.nextEvents).toHaveBeenCalledOnce()
})
it.each([0, 15, 60, 1440])('calcula anticipación %s con fecha civil y zona configurada', offset => {
  const [plan] = calculateReminders({ event: agenda({ reminder_minutes: offset }), eventType: 'agenda', preferences: repository.users[0], rules: [] })
  expect(plan.event_at.getTime() - plan.due_at.getTime()).toBe(offset * 60000)
  expect(plan.effective.date).toBe('2026-10-13')
})
