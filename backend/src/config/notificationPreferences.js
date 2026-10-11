export const notificationDefaults = Object.freeze({
  enabled: false, timezone: 'America/Argentina/Cordoba',
  exams_enabled: false, tasks_enabled: false,
  exam_default_time: '09:00', task_default_time: '09:00',
  exam_style: 'formal', task_style: 'formal', unfiltered_enabled: false,
  quiet_hours_enabled: false, quiet_start: null, quiet_end: null,
})
export const notificationStyles = ['formal', 'friendly', 'motivating', 'sarcastic', 'unfiltered']
export const maxRulesPerType = 5
export const maxOffsetMinutes = 30 * 24 * 60
export const notificationPreferenceFields = Object.keys(notificationDefaults)
