import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatStartupError, registerShutdown } from '../src/config/serverLifecycle.js'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

const setup = () => {
  const processRef = Object.assign(new EventEmitter(), { exit: vi.fn(), exitCode: 0 })
  let drained
  const server = { close: vi.fn((callback) => { drained = callback }), closeIdleConnections: vi.fn(), closeAllConnections: vi.fn() }
  const closeDatabase = vi.fn(async () => {})
  const app = { locals: {} }
  const shutdown = registerShutdown({ server, closeDatabase, app, processRef, timeoutMs: 1000 })
  return { processRef, server, closeDatabase, app, shutdown, drain: (error) => drained(error) }
}

describe('cierre ordenado', () => {
  it.each(['SIGTERM', 'SIGINT'])('drena HTTP antes de cerrar Sequelize ante %s', async (signal) => {
    const test = setup()
    test.processRef.emit(signal)
    expect(test.app.locals.shuttingDown).toBe(true)
    expect(test.server.close).toHaveBeenCalledOnce()
    expect(test.closeDatabase).not.toHaveBeenCalled()
    test.drain()
    await test.shutdown()
    expect(test.closeDatabase).toHaveBeenCalledOnce()
    expect(test.processRef.listenerCount('SIGTERM')).toBe(0)
    expect(test.processRef.listenerCount('SIGINT')).toBe(0)
    expect(test.processRef.exit).not.toHaveBeenCalled()
  })
  it('ignora señales repetidas y respeta el plazo máximo', async () => {
    vi.useFakeTimers()
    const test = setup()
    test.processRef.emit('SIGTERM')
    test.processRef.emit('SIGINT')
    expect(test.server.close).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1000)
    expect(test.server.closeAllConnections).toHaveBeenCalledOnce()
    expect(test.processRef.exit).toHaveBeenCalledWith(1)
    test.drain()
    await test.shutdown()
  })
  it('intenta cerrar Sequelize aunque falle el cierre HTTP', async () => {
    const test = setup()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const pending = test.shutdown()
    test.drain(new Error('test'))
    await pending
    expect(test.closeDatabase).toHaveBeenCalledOnce()
    expect(test.processRef.exitCode).toBe(1)
  })
})

describe('diagnóstico seguro de arranque', () => {
  it('identifica un puerto ocupado sin imprimir la excepción completa', () => {
    const output = formatStartupError({ code: 'EADDRINUSE', message: 'password=privada', stack: 'token privado' }, { stage: 'listen', port: 3000 })
    expect(output).toContain('EADDRINUSE'); expect(output).toContain('puerto 3000')
    expect(output).toContain('ya está ocupado')
    expect(output).not.toMatch(/password|privada|token/)
  })
  it.each(['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR'])('reconoce código anidado %s sin SQL ni credenciales', code => {
    const output = formatStartupError({ name: 'SequelizeConnectionError', original: { code, sql: 'secreto-sql', message: 'usuario privado' } }, { stage: 'database' })
    expect(output).toContain(code); expect(output).toContain('verificación de la base')
    expect(output).not.toMatch(/secreto-sql|usuario privado/)
  })
  it('no refleja códigos, etapas, puertos ni mensajes arbitrarios', () => {
    const output = formatStartupError({ code: 'secret-value', message: 'mysql://secreto', cause: { code: 'token' } }, { stage: 'password', port: 'secret' })
    expect(output).toContain('ERROR_NO_CLASIFICADO')
    expect(output).not.toMatch(/secret|mysql|password|token/)
  })
})
