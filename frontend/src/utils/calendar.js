export const DEFAULT_ZONE = 'America/Argentina/Cordoba'
export const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number(value.slice(0, 4)) >= 1000 && !Number.isNaN(Date.parse(value)) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value
export const todayIn = (zone = DEFAULT_ZONE, now = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(({ type, value }) => [type, value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
export const addDays = (date, count) => { const value = new Date(date + 'T12:00:00Z'); value.setUTCDate(value.getUTCDate() + count); return value.toISOString().slice(0, 10) }
export const monthStart = date => date.slice(0, 8) + '01'
export const moveMonth = (date, count) => { const value = new Date(monthStart(date) + 'T12:00:00Z'); value.setUTCMonth(value.getUTCMonth() + count); return value.toISOString().slice(0, 10) }
export const calendarDays = (date, view) => {
  const first = view === 'month' ? monthStart(date) : date
  const monday = addDays(first, -(new Date(first + 'T12:00:00Z').getUTCDay() + 6) % 7)
  return Array.from({ length: view === 'month' ? 42 : 7 }, (_, index) => addDays(monday, index))
}
export const dateLabel = date => new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'))
export const eventTypes = { exam: 'Examen', task: 'Tarea', personal: 'Personal', academic: 'Académico' }
export const eventTimeLabel = event => event.time || (['personal', 'academic'].includes(event.type) ? 'Todo el día' : 'Sin horario específico')
