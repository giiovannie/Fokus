import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyReminderStartupMode, isReminderWorkerEnabled } from '../src/config/reminderWorker.js'
import { app } from '../src/app.js'
import { runReminderWorker } from '../src/services/runReminderWorker.js'
import { sequelize } from '../src/models/index.js'
import webPush from 'web-push'

const originalArgv = process.argv
afterEach(() => { process.argv = originalArgv; vi.restoreAllMocks(); vi.unstubAllEnvs() })
describe('contingencia sin envíos ni cambios de esquema', () => {
  it('no cambia el arranque normal y apaga un worker habilitado al solicitar contingencia', () => {
    const env = { NOTIFICATION_WORKER_ENABLED: 'true' }
    applyReminderStartupMode(env, ['node', 'app.js'])
    expect(env.NOTIFICATION_WORKER_ENABLED).toBe('true')
    applyReminderStartupMode(env, ['node', 'app.js', '--disable-reminders'])
    expect(env.NOTIFICATION_WORKER_ENABLED).toBe('false')
  })
  it('mantiene health disponible pero bloquea HTTP y la confirmación local sin consultar ni enviar', async () => {
    const token = 'test-contingency-service-token-123456789'
    process.argv = [...process.argv, '--disable-reminders']
    vi.stubEnv('NOTIFICATION_WORKER_ENABLED', 'true')
    vi.stubEnv('NOTIFICATION_SERVICE_TOKEN', token)
    const query = vi.spyOn(sequelize, 'query').mockRejectedValue(new Error('No debe consultar'))
    const send = vi.spyOn(webPush, 'sendNotification').mockRejectedValue(new Error('No debe enviar'))
    expect(isReminderWorkerEnabled()).toBe(false)
    expect((await request(app).get('/api/health')).body).toEqual({ status: 'ok' })
    expect((await request(app).post('/api/internal/notifications/process').set('Authorization', 'Bearer ' + token).send({})).status).toBe(503)
    await expect(runReminderWorker({ localConfirmation: true })).rejects.toMatchObject({ status: 503 })
    expect(query).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })
})
