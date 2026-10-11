export const notificationStyles = [['formal', 'Formal'], ['friendly', 'Amigable'], ['motivating', 'Motivador'], ['sarcastic', 'Sarcástico'], ['unfiltered', 'Sin filtro'], ['custom', 'Mis propias frases']]
export const reminderUnits = { minutes: 1, hours: 60, days: 1440 }
const fields = ['enabled', 'timezone', 'exams_enabled', 'tasks_enabled', 'exam_default_time', 'task_default_time', 'exam_style', 'task_style', 'unfiltered_enabled', 'quiet_hours_enabled', 'quiet_start', 'quiet_end']
export const preferencesPayload = values => Object.fromEntries(fields.map(key => [key,
  !values.quiet_hours_enabled && ['quiet_start', 'quiet_end'].includes(key) ? null : values[key]]))
export const preferenceError = values => {
  try {
    if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+$/.test(values.timezone)) throw new Error()
    new Intl.DateTimeFormat('es', { timeZone: values.timezone })
  } catch { return 'Ingresá una zona horaria válida, por ejemplo America/Argentina/Cordoba.' }
  const time = /^([01]\d|2[0-3]):[0-5]\d$/
  if (![values.exam_default_time, values.task_default_time].every(value => time.test(value))) return 'Completá los horarios predeterminados con una hora válida.'
  if (values.quiet_hours_enabled && (!time.test(values.quiet_start) || !time.test(values.quiet_end) || values.quiet_start === values.quiet_end)) return 'El silencio necesita una hora de inicio y otra de fin diferentes.'
  if (!values.unfiltered_enabled && [values.exam_style, values.task_style].includes('unfiltered')) return 'El estilo sin filtro requiere tu aceptación explícita.'
  return null
}
export const reminderError = (draft, rules, editingId = null) => {
  const amount = Number(draft.amount), minutes = amount * reminderUnits[draft.unit]
  if (String(draft.amount).trim() === '' || !Number.isInteger(amount) || amount < 0 || !Number.isFinite(minutes) || minutes > 43200) return 'Usá una anticipación entera entre 0 y 30 días.'
  const others = rules.filter(rule => rule.id !== editingId)
  if (others.length >= 5) return 'Podés tener hasta 5 recordatorios por tipo, incluidos los desactivados.'
  if (others.some(rule => rule.offset_minutes === minutes)) return 'Ya tenés un recordatorio con esa anticipación.'
  return null
}
export const ruleDraft = rule => {
  const unit = rule.offset_minutes % 1440 === 0 ? 'days' : rule.offset_minutes % 60 === 0 ? 'hours' : 'minutes'
  return { amount: String(rule.offset_minutes / reminderUnits[unit]), unit, enabled: rule.enabled }
}
export const reminderLabel = minutes => {
  if (minutes === 0) return 'A la hora del evento'
  const unit = minutes % 1440 === 0 ? ['día', 'días', 1440] : minutes % 60 === 0 ? ['hora', 'horas', 60] : ['minuto', 'minutos', 1]
  const amount = minutes / unit[2]
  return amount + ' ' + unit[amount === 1 ? 0 : 1] + ' antes'
}
