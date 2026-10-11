import { describe, expect, it } from 'vitest'
import { calculateReminders, resolveEventTime, postponeSilence, eventHasExpired } from '../src/services/reminderTime.js'
import { notificationDefaults } from '../src/config/notificationPreferences.js'
const preferences = { ...notificationDefaults, enabled: true, exams_enabled: true, tasks_enabled: true }
const rule = (offset_minutes = 60, event_type = 'exam') => ({ event_type, offset_minutes, enabled: true })
const event = { exam_date: '2026-10-12', exam_time: null }
const iso = value => new Date(value).toISOString()
describe('motor temporal con zonas IANA', () => {
  it('usa 09:00 de Córdoba para DATEONLY sin convertir primero la fecha a UTC', () => {
    const [plan] = calculateReminders({ event, eventType: 'exam', preferences, rules: [rule()] })
    expect(iso(plan.event_at)).toBe('2026-10-12T12:00:00.000Z')
    expect(iso(plan.due_at)).toBe('2026-10-12T11:00:00.000Z')
    expect(plan.effective).toEqual({ date: '2026-10-12', time: '09:00', timezone: 'America/Argentina/Cordoba' })
  })
  it('hora explícita prevalece y los fallbacks de examen/entrega son independientes', () => {
    const [exam] = calculateReminders({ event: { ...event, exam_time: '15:00' }, eventType: 'exam', preferences: { ...preferences, exam_default_time: '08:00' }, rules: [rule()] })
    const [task] = calculateReminders({ event: { due_date: '2026-10-12', status: 'pending' }, eventType: 'task', preferences: { ...preferences, task_default_time: '18:00' }, rules: [rule(60, 'task')] })
    expect(iso(exam.event_at)).toBe('2026-10-12T18:00:00.000Z')
    expect(iso(task.event_at)).toBe('2026-10-12T21:00:00.000Z')
  })
  it.each([
    ['2026-03-08', '02:30', 'America/New_York', '2026-03-08T07:00:00.000Z', '03:00'],
    ['2026-11-01', '01:30', 'America/New_York', '2026-11-01T05:30:00.000Z', '01:30'],
    ['2026-10-04', '02:15', 'Australia/Lord_Howe', '2026-10-03T15:30:00.000Z', '02:30'],
    ['2011-12-30', '09:00', 'Pacific/Apia', '2011-12-30T10:00:00.000Z', '00:00'],
  ])('resuelve huecos/solapamientos %s %s %s', (date, time, timezone, expected, effective) => {
    const value = resolveEventTime(date, time, timezone)
    expect(iso(value.epochMilliseconds)).toBe(expected)
    expect(value.toPlainTime().toString().slice(0, 5)).toBe(effective)
  })
  it('resta días como minutos transcurridos aunque cambie el offset estacional', () => {
    const [plan] = calculateReminders({ event: { exam_date: '2026-03-08', exam_time: '09:00' }, eventType: 'exam', preferences: { ...preferences, timezone: 'America/New_York' }, rules: [rule(1440)] })
    expect(iso(plan.event_at)).toBe('2026-03-08T13:00:00.000Z')
    expect(iso(plan.due_at)).toBe('2026-03-07T13:00:00.000Z')
  })
  it('permite30días y rechaza anticipaciones mayores, negativas o fraccionarias', () => {
    expect(calculateReminders({ event, eventType: 'exam', preferences, rules: [rule(43200)] })).toHaveLength(1)
    for (const offset of [43201, -1, 0.5]) expect(() => calculateReminders({ event, eventType: 'exam', preferences, rules: [rule(offset)] })).toThrow()
    expect(() => calculateReminders({ event, eventType: 'exam', preferences, rules: Array.from({ length: 6 }, (_, index) => rule(index)) })).toThrow()
  })
  it('no planifica desactivados, tareas completadas ni avisos al instante del examen', () => {
    expect(calculateReminders({ event, eventType: 'exam', preferences: { ...preferences, enabled: false }, rules: [rule()] })).toEqual([])
    expect(calculateReminders({ event, eventType: 'exam', preferences, rules: [{ ...rule(), enabled: false }] })).toEqual([])
    expect(calculateReminders({ event: { due_date: '2026-10-12', status: 'completed' }, eventType: 'task', preferences, rules: [rule(60, 'task')] })).toEqual([])
    expect(calculateReminders({ event, eventType: 'exam', preferences, rules: [rule(0)] })).toEqual([])
    expect(eventHasExpired('exam', 100, 100)).toBe(true)
    expect(eventHasExpired('task', 100, 100)).toBe(false)
  })
})
describe('silencio basado en intervalos reales', () => {
  const quiet = { ...preferences, quiet_hours_enabled: true, quiet_start: '22:00', quiet_end: '08:00' }
  it('aplaza al día siguiente, incluye inicio y excluye final', () => {
    expect(iso(postponeSilence(Date.parse('2026-10-12T01:00Z'), quiet))).toBe('2026-10-12T11:00:00.000Z')
    expect(iso(postponeSilence(Date.parse('2026-10-12T10:00Z'), quiet))).toBe('2026-10-12T11:00:00.000Z')
    expect(iso(postponeSilence(Date.parse('2026-10-12T11:00Z'), quiet))).toBe('2026-10-12T11:00:00.000Z')
    expect(iso(postponeSilence(Date.parse('2026-10-12T00:59Z'), quiet))).toBe('2026-10-12T00:59:00.000Z')
  })
  it('no aplaza hasta después de vencer un examen y admite límite exacto de entrega', () => {
    expect(calculateReminders({ event: { ...event, exam_time: '07:00' }, eventType: 'exam', preferences: quiet, rules: [rule()] })).toEqual([])
    expect(calculateReminders({ event: { due_date: '2026-10-12', due_time: '08:00', status: 'pending' }, eventType: 'task', preferences: quiet, rules: [rule(60, 'task')] })).toHaveLength(1)
  })
  it('varias reglas pueden compartir el instante aplazado para fusionarse en la cola', () => {
    const plans = calculateReminders({ event, eventType: 'exam', preferences: quiet, rules: [rule(180), rule(240)] })
    expect(plans).toHaveLength(2)
    expect(iso(plans[0].due_at)).toBe(iso(plans[1].due_at))
  })
  it('silencio con fin ambiguo usa primera ocurrencia, sin aplazar la segunda', () => {
    const saved = { ...quiet, timezone: 'America/New_York', quiet_start: '01:00', quiet_end: '01:30' }
    expect(iso(postponeSilence(Date.parse('2026-11-01T05:15Z'), saved))).toBe('2026-11-01T05:30:00.000Z')
    expect(iso(postponeSilence(Date.parse('2026-11-01T06:15Z'), saved))).toBe('2026-11-01T06:15:00.000Z')
  })
  it('silencio con final inexistente termina en primera hora válida', () => {
    const saved = { ...quiet, timezone: 'America/New_York', quiet_start: '22:00', quiet_end: '02:30' }
    expect(iso(postponeSilence(Date.parse('2026-03-08T06:00Z'), saved))).toBe('2026-03-08T07:00:00.000Z')
  })
})
