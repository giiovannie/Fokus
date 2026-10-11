import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/migrations/runner.js', () => ({ verifyMigrations: vi.fn(), migrate: vi.fn() }))
vi.mock('../src/models/index.js', () => ({
  sequelize: { authenticate: vi.fn(), sync: vi.fn() },
}))
const { sequelize } = await import('../src/models/index.js')
const { initializeDatabase } = await import('../src/config/initializeDatabase.js')
const { verifyMigrations, migrate } = await import('../src/migrations/runner.js')
const modes = ['development', 'test', 'production', undefined]
const setMode = mode => mode === undefined ? vi.stubEnv('NODE_ENV', undefined) : vi.stubEnv('NODE_ENV', mode)

describe('initializeDatabase', () => {
  beforeEach(() => vi.resetAllMocks())
  afterEach(() => vi.unstubAllEnvs())

  it.each(modes)('autentica y verifica el esquema sin escribir en modo %s', async mode => {
    setMode(mode)
    await initializeDatabase()
    expect(sequelize.authenticate).toHaveBeenCalledOnce()
    expect(verifyMigrations).toHaveBeenCalledExactlyOnceWith(sequelize)
    expect(sequelize.authenticate.mock.invocationCallOrder[0]).toBeLessThan(verifyMigrations.mock.invocationCallOrder[0])
    expect(sequelize.sync).not.toHaveBeenCalled()
    expect(migrate).not.toHaveBeenCalled()
  })

  it('no verifica ni modifica el esquema cuando falla la conexión', async () => {
    sequelize.authenticate.mockRejectedValueOnce(new Error('connection failed'))
    await expect(initializeDatabase()).rejects.toThrow('connection failed')
    expect(verifyMigrations).not.toHaveBeenCalled()
    expect(sequelize.sync).not.toHaveBeenCalled()
    expect(migrate).not.toHaveBeenCalled()
  })

  it.each(modes)('rechaza el arranque sin ejecutar migraciones pendientes en modo %s', async mode => {
    setMode(mode)
    const failure = new Error('Hay migraciones pendientes; ejecutarlas manualmente antes del despliegue')
    verifyMigrations.mockRejectedValueOnce(failure)
    await expect(initializeDatabase()).rejects.toBe(failure)
    expect(sequelize.sync).not.toHaveBeenCalled()
    expect(migrate).not.toHaveBeenCalled()
  })
})
