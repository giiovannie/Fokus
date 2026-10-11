import { getPushConfiguration } from '../config/webPush.js'
import { isReminderContingencyMode, isReminderWorkerEnabled } from '../config/reminderWorker.js'
import { verifyMigrations } from '../migrations/runner.js'
import { sequelize } from '../models/index.js'
import { createHttpError } from '../utils/httpError.js'
import { ReminderRepository } from './reminderRepository.js'
import { processReminderBatch } from './reminderProcessor.js'
import { deliverReminder } from './reminderPush.js'
import { markReminderWorkerError } from '../utils/reminderWorkerDiagnostic.js'
export const runReminderWorker = async ({ localConfirmation = false } = {}) => {
  if (isReminderContingencyMode() || (!localConfirmation && !isReminderWorkerEnabled())) throw createHttpError(503, 'El procesamiento automático todavía no está habilitado.')
  let stage = 'configuration'
  try {
    if (!getPushConfiguration()) throw createHttpError(503, 'Falta configurar Web Push en el backend.')
    stage = 'migrations'
    await verifyMigrations(sequelize)
    stage = 'processing'
    return await processReminderBatch({ repository: new ReminderRepository(), send: deliverReminder })
  } catch (error) {
    throw markReminderWorkerError(error, stage)
  }
}
