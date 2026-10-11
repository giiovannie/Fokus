import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from '../src/app.js'
import { runReminderWorker } from '../src/services/runReminderWorker.js'
vi.mock('../src/services/runReminderWorker.js', () => ({ runReminderWorker: vi.fn() }))
const token = 'test-service-token-not-a-real-secret-12345'
const call = bearer => { const req = request(app).post('/api/internal/notifications/process'); return bearer ? req.set('Authorization', 'Bearer ' + bearer) : req }
beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); vi.stubEnv('NOTIFICATION_SERVICE_TOKEN', token); vi.stubEnv('NOTIFICATION_WORKER_ENABLED', 'true'); vi.mocked(runReminderWorker).mockReset().mockResolvedValue({ sent: 1 }) })
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })
describe('autenticaci?n exclusiva del procesador', () => {
  it.each([undefined, 'student-jwt', 'wrong-service-token'])('rechaza %s sin ejecutar el motor', async bearer => {
    expect((await call(bearer)).status).toBe(401)
    expect(runReminderWorker).not.toHaveBeenCalled()
  })
  it('permanece deshabilitado por defecto', async () => {
    vi.stubEnv('NOTIFICATION_WORKER_ENABLED', 'false')
    expect((await call(token)).status).toBe(503)
    expect(runReminderWorker).not.toHaveBeenCalled()
  })
  it('no permite seleccionar otro estudiante o aumentar el lote', async () => {
    expect((await call(token).send({ user_id: 8, limit: 5000 })).status).toBe(400)
    expect(runReminderWorker).not.toHaveBeenCalled()
  })
  it('ejecuta un lote y devuelve ?nicamente contadores', async () => {
    const result = await call(token).send({})
    expect(result.status).toBe(200); expect(result.body).toEqual({ sent: 1 })
  })
  it('oculta excepciones de conexi?n o proveedor', async () => {
    vi.mocked(runReminderWorker).mockRejectedValue(new Error('private-database-value'))
    const result = await call(token)
    expect(console.error).toHaveBeenCalledWith('notification_worker_failed', { stage: 'unknown', code: 'WORKER_FAILED' })
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private-database-value')
    expect(result.status).toBe(503); expect(JSON.stringify(result.body)).not.toContain('private-database-value')
  })
})
