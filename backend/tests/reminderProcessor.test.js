import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReminderMemory } from './helpers/reminderMemory.js'
import { processReminderBatch } from '../src/services/reminderProcessor.js'
import { workerLimits } from '../src/config/reminderWorker.js'
let repository, send
const run = (options = {}) => processReminderBatch({ repository, send, ...options })
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime('2026-10-12T11:00Z'); repository = new ReminderMemory(); send = vi.fn().mockResolvedValue(undefined) })
afterEach(() => vi.useRealTimers())
describe('recordatorios persistentes con reloj simulado', () => {
  it('avanza delivery y envía antes de una reconciliación que consume el presupuesto', async () => {
    vi.setSystemTime('2026-10-12T10:00Z'); await run()
    vi.setSystemTime('2026-10-12T11:00Z')
    const advance = vi.spyOn(repository, 'advanceDelivery')
    const reconcile = repository.nextReconciliation.bind(repository)
    vi.spyOn(repository, 'nextReconciliation').mockImplementation(async (...args) => {
      const rows = await reconcile(...args)
      vi.setSystemTime(Date.now() + workerLimits.durationMs + 1)
      return rows
    })
    const result = await run()
    expect(advance).toHaveBeenCalledWith(1)
    expect(result.deliveriesAttempted).toBe(1)
    expect(result.sent).toBe(1)
    expect(repository.records[0].status).toBe('sent')
    expect(advance.mock.invocationCallOrder[0]).toBeLessThan(repository.nextReconciliation.mock.invocationCallOrder[0])
    await run(); expect(send).toHaveBeenCalledOnce()
  })
  it('no avanza delivery ni crea entregas para Simulacro antes del 13/10 a las 06:00 Argentina', async () => {
    repository.events = [{ ...repository.events[0], exam_date: '2026-10-13', exam_time: '09:00' }]
    repository.rules = [4320,1440,180,60].map((offset_minutes,id) => ({ id, user_id: 7, event_type: 'exam', offset_minutes, enabled: true }))
    const advance = vi.spyOn(repository, 'advanceDelivery')
    vi.setSystemTime('2026-10-12T13:41:00Z') // Creación confirmada: 10:41 Argentina.
    await run()
    expect(repository.jobs.map(row => row.offset_minutes)).toEqual([180,60])
    vi.setSystemTime('2026-10-12T21:42:00Z'); await run()
    expect(advance).not.toHaveBeenCalled()
    expect(repository.records).toHaveLength(0)
    expect(repository.jobs.every(row => row.status === 'pending')).toBe(true)
    vi.setSystemTime('2026-10-13T09:00:00Z'); await run()
    expect(advance).toHaveBeenCalledWith(1)
    expect(repository.records[0].status).toBe('sent')
  })
  it('entrega pendientes vencidos antes de que la planificación agote los 20 segundos', async () => {
    vi.setSystemTime('2026-10-12T10:00Z'); await run()
    vi.setSystemTime('2026-10-12T11:00Z')
    const plan = repository.planEvent.bind(repository)
    vi.spyOn(repository, 'planEvent').mockImplementation(async (...args) => {
      await plan(...args)
      vi.setSystemTime(Date.now() + workerLimits.durationMs + 1)
    })
    const result = await run()
    expect(result.deliveriesAttempted).toBe(1)
    expect(result.sent).toBe(1)
    expect(repository.records[0].status).toBe('sent')
    expect(repository.jobs[0].status).toBe('processed')
    await run(); expect(send).toHaveBeenCalledOnce()
  })
  it('revalida reglas antes de enviar un pendiente aunque se difiera la planificación', async () => {
    vi.setSystemTime('2026-10-12T10:00Z'); await run()
    repository.rules[0].enabled = false
    vi.setSystemTime('2026-10-12T11:00Z')
    await run()
    expect(send).not.toHaveBeenCalled()
    expect(repository.jobs[0].status).toBe('cancelled')
  })
  it('mantiene el límite de pendientes entre las dos pasadas de entrega', async () => {
    vi.setSystemTime('2026-10-12T10:00Z'); await run()
    repository.events.push({ ...repository.events[0], id: 2 })
    vi.setSystemTime('2026-10-12T11:00Z')
    const first = await run({ limits: { ...workerLimits, reminders: 1 } })
    expect(first.sent).toBe(1)
    expect(repository.jobs.find(row => row.event_id === 2).status).toBe('pending')
    const second = await run({ limits: { ...workerLimits, reminders: 1 } })
    expect(second.sent).toBe(1)
    expect(send).toHaveBeenCalledTimes(2)
  })
  it('crea solo avisos futuros para un examen de Argentina creado después de 3 días y 1 día', async () => {
    repository.events = [{ ...repository.events[0], title: 'Simulacro (simulación)', exam_date: '2026-10-13', exam_time: '09:00' }]
    repository.rules = [4320,1440,180,60].map((offset_minutes,id) => ({ id, user_id: 7, event_type: 'exam', offset_minutes, enabled: true }))
    vi.setSystemTime('2026-10-12T15:00Z') // 12:00 Argentina; el aviso de 1 día vencía a las 09:00.
    await run()
    expect(repository.jobs.map(row => row.offset_minutes)).toEqual([180,60])
    expect(repository.jobs.map(row => row.due_at.toISOString())).toEqual(['2026-10-13T09:00:00.000Z','2026-10-13T11:00:00.000Z'])
    expect(send).not.toHaveBeenCalled()
    vi.setSystemTime('2026-10-13T09:00:00Z'); await run()
    vi.setSystemTime('2026-10-13T11:00:00Z'); await run(); await run()
    expect(send).toHaveBeenCalledTimes(2)
    expect(repository.jobs.every(row => row.status === 'processed')).toBe(true)
  })
  it('envía una vez a cada dispositivo propio y nunca a otro usuario', async () => {
    repository.devices.push({ id: 2, user_id: 7, device_id: 'device-b' }, { id: 3, user_id: 8, device_id: 'device-c' })
    const result = await run()
    expect(result.sent).toBe(2); expect(repository.jobs[0].status).toBe('processed')
    const [device, message, options] = send.mock.calls[0]
    expect(device.user_id).toBe(7)
    expect(message.body).toContain('Matemática real'); expect(message.body).toContain('Parcial real')
    expect(message.body).toContain('12/10/2026'); expect(message.body).toContain('09:00')
    expect(message.body).not.toContain('[PRUEBA]'); expect(options.id).toBe('reminder-1-1')
    expect(options.ttl).toBe(300)
    await run(); expect(send).toHaveBeenCalledTimes(2)
  })
  it('no envía antes del instante y conserva fechas/horas UTC', async () => {
    vi.setSystemTime('2026-10-12T10:59Z'); await run()
    expect(send).not.toHaveBeenCalled(); expect(repository.jobs[0].due_at.toISOString()).toBe('2026-10-12T11:00:00.000Z')
    vi.setSystemTime('2026-10-12T11:00Z'); await run(); expect(send).toHaveBeenCalledOnce()
  })
  it('recalcula fecha/hora, fallback y zona sin reenviar entregados', async () => {
    vi.setSystemTime('2026-10-12T10:00Z'); await run()
    repository.events[0].exam_date = '2026-10-13'; repository.events[0].exam_time = null
    repository.users[0].exam_default_time = '10:00'; repository.users[0].timezone = 'America/New_York'
    await run(); expect(repository.jobs[0].due_at.toISOString()).toBe('2026-10-13T13:00:00.000Z')
    vi.setSystemTime('2026-10-13T13:00Z'); await run(); expect(send).toHaveBeenCalledOnce()
    repository.events[0].exam_date = '2026-10-14'; vi.setSystemTime('2026-10-14T13:00Z')
    await run(); expect(send).toHaveBeenCalledOnce()
  })
  it('cambiar fallback no desplaza eventos con hora explícita', async () => {
    vi.setSystemTime('2026-10-12T10:00Z'); await run(); repository.users[0].exam_default_time = '18:00'
    await run(); expect(repository.jobs[0].due_at.toISOString()).toBe('2026-10-12T11:00:00.000Z')
  })
  it.each(['preference', 'type', 'rule', 'deleted-rule', 'deleted-event'])('cancela pendientes al revocar o eliminar %s', async change => {
    vi.setSystemTime('2026-10-12T10:00Z'); await run()
    if (change === 'preference') repository.users[0].enabled = false
    if (change === 'type') repository.users[0].exams_enabled = false
    if (change === 'rule') repository.rules[0].enabled = false
    if (change === 'deleted-rule') repository.rules = []
    if (change === 'deleted-event') repository.events = []
    await run(); expect(repository.jobs[0].status).toBe('cancelled'); expect(send).not.toHaveBeenCalled()
  })
  it('reactiva pendientes cancelados sin duplicar su identidad', async () => {
    vi.setSystemTime('2026-10-12T10:00Z'); await run(); repository.users[0].enabled = false; await run()
    repository.users[0].enabled = true; vi.setSystemTime('2026-10-12T11:00Z'); await run()
    expect(repository.jobs).toHaveLength(1); expect(send).toHaveBeenCalledOnce()
  })
  it('una tarea completada nunca se envía, aunque ya estuviera planificada', async () => {
    repository.events = [{ id: 1, type: 'task', title: 'Entrega real', due_date: '2026-10-12', due_time: '09:00', status: 'pending', subject: { user_id: 7, name: 'Historia' } }]
    repository.rules[0].event_type = 'task'
    vi.setSystemTime('2026-10-12T10:00Z'); await run()
    repository.events[0].status = 'completed'; vi.setSystemTime('2026-10-12T11:00Z'); await run()
    expect(repository.jobs[0].status).toBe('cancelled'); expect(send).not.toHaveBeenCalled()
  })
  it('relee cada evento antes de entregar y no avisa a segundo dispositivo tras completar', async () => {
    repository.events = [{ ...repository.events[0], type: 'task', due_date: '2026-10-12', due_time: '09:00', status: 'pending' }]; repository.rules[0].event_type = 'task'
    repository.devices.push({ id: 2, user_id: 7, device_id: 'device-b' })
    send.mockImplementation(async () => { repository.events[0].status = 'completed' })
    await run(); expect(send).toHaveBeenCalledOnce(); expect(repository.jobs[0].status).toBe('cancelled')
  })
  it('no envía exámenes vencidos ni atrasos fuera de ventana de15minutos', async () => {
    vi.setSystemTime('2026-10-12T10:00Z'); await run()
    vi.setSystemTime('2026-10-12T11:16Z'); await run()
    expect(repository.jobs[0].status).toBe('cancelled'); expect(send).not.toHaveBeenCalled()
    vi.setSystemTime('2026-10-12T12:00Z'); await run(); expect(send).not.toHaveBeenCalled()
  })
  it('fusión de reglas aplazadas por silencio produce solo un aviso', async () => {
    Object.assign(repository.users[0], { quiet_hours_enabled: true, quiet_start: '22:00', quiet_end: '08:00' })
    repository.rules = [180,240].map((offset_minutes,id) => ({ id, user_id: 7, event_type: 'exam', offset_minutes, enabled: true }))
    await run(); expect(repository.jobs).toHaveLength(2); expect(send).toHaveBeenCalledOnce()
    expect(repository.jobs.map(row => row.status)).toEqual(['processed','cancelled'])
    await run(); expect(send).toHaveBeenCalledOnce()
  })
  it('usa estilo/frases actuales del usuario y mantiene información real independiente', async () => {
    repository.users[0].exam_style = 'custom'; repository.phrases = [{ user_id: 7, event_type: 'exam', content: 'Mi frase real' }, { user_id: 8, event_type: 'exam', content: 'Frase ajena' }]
    await run(); expect(send.mock.calls[0][1].body).toContain('Mi frase real'); expect(send.mock.calls[0][1].body).not.toContain('Frase ajena')
    expect(send.mock.calls[0][1].body).toContain('Matemática real')
  })
  it('sin filtro revocado usa formal, sin cambiar preferencias', async () => {
    repository.users[0].exam_style = 'unfiltered'; await run()
    expect(send.mock.calls[0][1].phrase).not.toContain('boludear'); expect(repository.users[0].exam_style).toBe('unfiltered')
  })
  it('selecciona otra frase cuando existe una alternativa al aviso previo', async () => {
    repository.users[0].exam_style = 'custom'; repository.phrases = ['Primera','Segunda'].map(content => ({ user_id: 7, event_type: 'exam', content }))
    await run(); const first = send.mock.calls[0][1].phrase
    repository.events.push({ ...repository.events[0], id: 2 }); await run()
    expect(send.mock.calls[1][1].phrase).not.toBe(first)
  })
  it('reintenta solo rechazo confirmado y no duplica dispositivos ya aceptados', async () => {
    repository.devices.push({ id: 2, user_id: 7, device_id: 'device-b' })
    send.mockImplementation(async subscription => { if (subscription.id === 2 && repository.records[1].attempts === 1) throw { retryable: true, deliveryCode: 'provider_busy' } })
    const result = await run(); expect(result.retried).toBe(1); expect(result.sent).toBe(1)
    await run(); expect(send).toHaveBeenCalledTimes(2)
    vi.setSystemTime('2026-10-12T11:01Z'); await run(); expect(send).toHaveBeenCalledTimes(3)
    expect(repository.records.map(row => row.attempts)).toEqual([1,2]); expect(repository.jobs[0].status).toBe('processed')
  })
  it('limita3intentos, usa espera1/5minutos y falla sin reintentos permanentes', async () => {
    send.mockRejectedValue({ retryable: true, deliveryCode: 'provider_busy' })
    await run(); expect(repository.records[0].next_attempt_at.toISOString()).toBe('2026-10-12T11:01:00.000Z')
    vi.setSystemTime('2026-10-12T11:01Z'); await run(); expect(repository.records[0].next_attempt_at.toISOString()).toBe('2026-10-12T11:06:00.000Z')
    vi.setSystemTime('2026-10-12T11:06Z'); await run(); await run()
    expect(send).toHaveBeenCalledTimes(3); expect(repository.jobs[0].status).toBe('failed')
  })
  it('un timeout incierto no se reintenta automáticamente', async () => {
    send.mockRejectedValue({ deliveryCode: 'delivery_uncertain', message: 'secret' }); await run(); await run()
    expect(send).toHaveBeenCalledOnce(); expect(repository.records[0].status).toBe('failed'); expect(repository.records[0].last_error_code).toBe('delivery_uncertain')
  })
  it('recupera processing de ejecución interrumpida como incierto sin reenviar', async () => {
    vi.setSystemTime('2026-10-12T10:00Z'); await run()
    repository.records.push({ id: 1, reminder_id: 1, device_id: 'device-a', status: 'processing', attempts: 1, next_attempt_at: new Date() })
    vi.setSystemTime('2026-10-12T11:00Z'); await run()
    expect(send).not.toHaveBeenCalled(); expect(repository.records[0].last_error_code).toBe('delivery_uncertain')
  })
  it('elimina solo suscripción caducada y entrega a otros dispositivos', async () => {
    repository.devices.push({ id: 2, user_id: 7, device_id: 'device-b' })
    send.mockImplementation(async row => { if (row.id === 1) throw { expired: true, deliveryCode: 'subscription_expired' } })
    await run(); expect(repository.devices.map(row => row.id)).toEqual([2]); expect(repository.records[0].status).toBe('failed'); expect(repository.records[1].status).toBe('sent')
  })
  it('sin suscripciones espera sin aparentar una entrega', async () => {
    repository.devices = []; await run(); expect(repository.jobs[0].status).toBe('pending'); expect(send).not.toHaveBeenCalled()
  })
  it('serializa ejecuciones concurrentes y no duplica un envío', async () => {
    let release
    send.mockImplementation(() => new Promise(resolve => { release = resolve }))
    const first = run()
    for (let i = 0; i < 50 && !release; i++) await Promise.resolve()
    expect(await run()).toEqual({ skipped: 'busy' })
    release(); await first; await run(); expect(send).toHaveBeenCalledOnce()
  })
  it('acota entregas y continúa dispositivos restantes en el siguiente lote', async () => {
    repository.devices.push({ id: 2, user_id: 7, device_id: 'device-b' })
    await run({ limits: { ...workerLimits, deliveries: 1 } }); expect(send).toHaveBeenCalledOnce(); expect(repository.jobs[0].status).toBe('pending')
    await run({ limits: { ...workerLimits, deliveries: 1 } }); expect(send).toHaveBeenCalledTimes(2); expect(repository.jobs[0].status).toBe('processed')
  })
})

it('cancela el reintento del dispositivo eliminado sin bloquear al restante', async () => {
  repository.devices.push({ id: 2, user_id: 7, device_id: 'device-b', endpoint_hash: 'hash-b' })
  send.mockImplementation(async device => { if (device.id === 1) throw Object.assign(new Error('busy'), { retryable: true, deliveryCode: 'provider_busy' }) })
  await run(); expect(repository.records[0].status).toBe('pending')
  repository.devices = repository.devices.filter(device => device.id !== 1)
  await run()
  expect(repository.records[0].status).toBe('cancelled')
  expect(repository.jobs[0].status).toBe('processed')
  expect(send).toHaveBeenCalledTimes(2)
})
