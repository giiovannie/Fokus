import { expect, it } from 'vitest'
import { todayIn, addDays, calendarDays, validDate, moveMonth, eventTimeLabel, dateLabel } from './calendar.js'
it('mantiene el día de Argentina cerca de medianoche UTC', () => {
  expect(todayIn('America/Argentina/Cordoba', new Date('2026-10-13T02:59:00Z'))).toBe('2026-10-12')
  expect(todayIn('America/Argentina/Cordoba', new Date('2026-10-13T03:00:00Z'))).toBe('2026-10-13')
  expect(dateLabel('2026-10-13')).toContain('13 de octubre')
})
it('avanza fechas civiles entre años y años bisiestos sin convertir a hora local', () => {
  expect(addDays('2028-02-28', 1)).toBe('2028-02-29'); expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  expect(moveMonth('2026-01-31', 1)).toBe('2026-02-01')
})
it('genera rangos de lunes a domingo acotados para mes y semana', () => {
  expect(calendarDays('2026-10-13', 'week')).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'])
  const month = calendarDays('2026-10-13', 'month'); expect(month).toHaveLength(42); expect(month[0]).toBe('2026-09-28'); expect(month.at(-1)).toBe('2026-11-08')
})
it.each(['2026-02-30', '2026-1-01', '0001-01-01', '', undefined])('rechaza fecha inválida %s', date => expect(validDate(date)).toBe(false))
it('diferencia eventos de día completo y actividades existentes sin horario', () => {
  expect(validDate('2028-02-29')).toBe(true)
  expect(eventTimeLabel({ type: 'personal', time: null })).toBe('Todo el día')
  expect(eventTimeLabel({ type: 'exam', time: null })).toBe('Sin horario específico')
})
