export const workerLimits = Object.freeze({ users: 20, eventsPerType: 50, reminders: 25, deliveries: 25, durationMs: 20000, catchUpMs: 15 * 60000, maxAttempts: 3 })
export const isReminderContingencyMode = (args = process.argv) => args.includes('--disable-reminders')
export const applyReminderStartupMode = (env = process.env, args = process.argv) => {
  if (isReminderContingencyMode(args)) env.NOTIFICATION_WORKER_ENABLED = 'false'
}
export const isReminderWorkerEnabled = (env = process.env) => !isReminderContingencyMode() && env.NOTIFICATION_WORKER_ENABLED === 'true'
export const validateWorkerEnvironment = env => {
  if (env.NOTIFICATION_WORKER_ENABLED && !['true', 'false'].includes(env.NOTIFICATION_WORKER_ENABLED)) return false
  if (env.NOTIFICATION_SERVICE_TOKEN && (env.NOTIFICATION_SERVICE_TOKEN.length < 32 || /\s/.test(env.NOTIFICATION_SERVICE_TOKEN))) return false
  return true
}
