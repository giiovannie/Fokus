import { Temporal } from '@js-temporal/polyfill'
import { notificationDefaults, maxOffsetMinutes } from '../config/notificationPreferences.js'

// Primera ocurrencia en un solapamiento; inicio exacto del tramo válido tras un hueco.
export const resolveEventTime = (date, time, timezone) => {
  const local = Temporal.PlainDateTime.from(date + 'T' + time.slice(0, 5))
  const earlier = local.toZonedDateTime(timezone, { disambiguation: 'earlier' })
  if (earlier.toPlainDateTime().equals(local)) return earlier
  const later = local.toZonedDateTime(timezone, { disambiguation: 'later' })
  let low = earlier.epochMilliseconds, high = later.epochMilliseconds
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    const actual = Temporal.Instant.fromEpochMilliseconds(middle).toZonedDateTimeISO(timezone).toPlainDateTime()
    if (Temporal.PlainDateTime.compare(actual, local) >= 0) high = middle
    else low = middle
  }
  return Temporal.Instant.fromEpochMilliseconds(high).toZonedDateTimeISO(timezone)
}
export const postponeSilence = (instant, preferences) => {
  if (!preferences.quiet_hours_enabled) return instant
  const start = preferences.quiet_start?.slice(0, 5), end = preferences.quiet_end?.slice(0, 5)
  if (!start || !end || start === end) throw new Error('Invalid quiet hours')
  const date = Temporal.Instant.fromEpochMilliseconds(instant).toZonedDateTimeISO(preferences.timezone).toPlainDate()
  for (const day of [date.subtract({ days: 1 }), date]) {
    const from = resolveEventTime(day.toString(), start, preferences.timezone).epochMilliseconds
    const until = resolveEventTime((end < start ? day.add({ days: 1 }) : day).toString(), end, preferences.timezone).epochMilliseconds
    if (instant >= from && instant < until) return until
  }
  return instant
}
export const eventHasExpired = (type, eventAt, now) => type === 'exam' ? eventAt <= now : eventAt < now
export const calculateReminders = ({ event, eventType, preferences: saved, rules }) => {
  const preferences = { ...notificationDefaults, ...saved }
  if (!preferences.enabled || !preferences[eventType === 'exam' ? 'exams_enabled' : 'tasks_enabled'] || (eventType === 'task' && event.status === 'completed')) return []
  const ownRules = rules.filter(rule => rule.event_type === eventType)
  if (ownRules.length > 5) throw new Error('Too many reminder rules')
  const date = event[eventType === 'exam' ? 'exam_date' : 'due_date']
  const time = event[eventType === 'exam' ? 'exam_time' : 'due_time'] || preferences[eventType + '_default_time']
  const effective = resolveEventTime(date, time, preferences.timezone)
  return ownRules.filter(rule => rule.enabled).flatMap(rule => {
    if (!Number.isInteger(rule.offset_minutes) || rule.offset_minutes < 0 || rule.offset_minutes > maxOffsetMinutes) throw new Error('Invalid reminder offset')
    const original = effective.epochMilliseconds - rule.offset_minutes * 60000
    const due = postponeSilence(original, preferences)
    if (eventHasExpired(eventType, effective.epochMilliseconds, due)) return []
    return [{ offset_minutes: rule.offset_minutes, due_at: new Date(due), event_at: new Date(effective.epochMilliseconds),
      effective: { date: effective.toPlainDate().toString(), time: effective.toPlainTime().toString().slice(0, 5), timezone: preferences.timezone } }]
  })
}
export const localPlanningDates = (now, timezone) => {
  const date = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(timezone).toPlainDate()
  return [date.toString(), date.add({ days: 31 }).toString()]
}
