import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerShutdown } from '../src/config/serverLifecycle.js'

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
