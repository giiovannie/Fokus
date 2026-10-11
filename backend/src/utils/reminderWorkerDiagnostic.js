const diagnostics = new WeakMap()
const databaseCodes = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND',
  'ER_ACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR',
  'ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ER_LOCK_WAIT_TIMEOUT', 'ER_LOCK_DEADLOCK',
  'ER_CON_COUNT_ERROR', 'ER_GET_CONNECTION_TIMEOUT', 'POOL_ENQUEUELIMIT',
])
const fallbackCodes = {
  configuration: 'VAPID_CONFIGURATION_FAILED',
  migrations: 'MIGRATION_VERIFICATION_FAILED',
  processing: 'BATCH_PROCESSING_FAILED',
}
// Sólo códigos conocidos: nunca registrar message, stack, SQL ni valores de conexión.
export const markReminderWorkerError = (error, stage) => {
  const failure = error instanceof Error ? error : new Error('Reminder worker failed')
  const code = [failure.original?.code, failure.parent?.code, failure.code]
    .find(value => databaseCodes.has(value)) || fallbackCodes[stage]
  diagnostics.set(failure, { stage, code })
  return failure
}
export const reminderWorkerDiagnostic = error => diagnostics.get(error) || {
  stage: 'unknown', code: 'WORKER_FAILED',
}
