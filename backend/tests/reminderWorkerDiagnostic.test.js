import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runReminderWorker } from '../src/services/runReminderWorker.js'
import { getPushConfiguration } from '../src/config/webPush.js'
import { isReminderContingencyMode, isReminderWorkerEnabled } from '../src/config/reminderWorker.js'
import { verifyMigrations } from '../src/migrations/runner.js'
import { processReminderBatch } from '../src/services/reminderProcessor.js'
import { markReminderWorkerError, reminderWorkerDiagnostic } from '../src/utils/reminderWorkerDiagnostic.js'
vi.mock('../src/config/webPush.js', () => ({ getPushConfiguration: vi.fn() }))
vi.mock('../src/config/reminderWorker.js', () => ({ isReminderContingencyMode: vi.fn(), isReminderWorkerEnabled: vi.fn() }))
vi.mock('../src/migrations/runner.js', () => ({ verifyMigrations: vi.fn() }))
vi.mock('../src/models/index.js', () => ({ sequelize: {} }))
vi.mock('../src/services/reminderRepository.js', () => ({ ReminderRepository: class {} }))
vi.mock('../src/services/reminderProcessor.js', () => ({ processReminderBatch: vi.fn() }))
vi.mock('../src/services/reminderPush.js', () => ({ deliverReminder: vi.fn() }))
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(isReminderWorkerEnabled).mockReturnValue(true)
  vi.mocked(isReminderContingencyMode).mockReturnValue(false)
  vi.mocked(getPushConfiguration).mockReturnValue({})
  vi.mocked(verifyMigrations).mockResolvedValue({})
  vi.mocked(processReminderBatch).mockResolvedValue({ sent: 0 })
})
const failureDiagnostic = async () => {
  try { await runReminderWorker(); throw new Error('Expected rejection') }
  catch (error) { return reminderWorkerDiagnostic(error) }
}
describe('diagnóstico seguro del motor', () => {
  it.each(['missing', 'invalid'])('identifica configuración %s antes de consultar la base', async kind => {
    if (kind === 'missing') vi.mocked(getPushConfiguration).mockReturnValue(null)
    else vi.mocked(getPushConfiguration).mockImplementation(() => { throw new Error('private VAPID value') })
    expect(await failureDiagnostic()).toEqual({ stage: 'configuration', code: 'VAPID_CONFIGURATION_FAILED' })
    expect(verifyMigrations).not.toHaveBeenCalled()
    expect(processReminderBatch).not.toHaveBeenCalled()
  })
  it('identifica verificación de historial y detiene el lote', async () => {
    vi.mocked(verifyMigrations).mockRejectedValue(new Error('private migration details'))
    expect(await failureDiagnostic()).toEqual({ stage: 'migrations', code: 'MIGRATION_VERIFICATION_FAILED' })
    expect(processReminderBatch).not.toHaveBeenCalled()
  })
  it('captura rechazos asíncronos MySQL del procesamiento', async () => {
    vi.mocked(processReminderBatch).mockRejectedValue(Object.assign(new Error('private SQL'), {
      parent: { code: 'ER_TABLEACCESS_DENIED_ERROR', sql: 'private SQL' },
    }))
    expect(await failureDiagnostic()).toEqual({ stage: 'processing', code: 'ER_TABLEACCESS_DENIED_ERROR' })
    expect(processReminderBatch).toHaveBeenCalledTimes(1)
  })
  it('excluye mensajes, stack y códigos arbitrarios del diagnóstico', () => {
    const error = Object.assign(new Error('private password'), { code: 'private token', stage: 'private host' })
    expect(reminderWorkerDiagnostic(markReminderWorkerError(error, 'processing')))
      .toEqual({ stage: 'processing', code: 'BATCH_PROCESSING_FAILED' })
  })
  it('conserva resultados exitosos sin reintentos', async () => {
    expect(await runReminderWorker()).toEqual({ sent: 0 })
    expect(processReminderBatch).toHaveBeenCalledTimes(1)
  })
  it('conserva el bloqueo de contingencia sin consultar ni enviar', async () => {
    vi.mocked(isReminderContingencyMode).mockReturnValue(true)
    await expect(runReminderWorker({ localConfirmation: true })).rejects.toMatchObject({ status: 503 })
    expect(getPushConfiguration).not.toHaveBeenCalled()
    expect(verifyMigrations).not.toHaveBeenCalled()
    expect(processReminderBatch).not.toHaveBeenCalled()
  })
})
