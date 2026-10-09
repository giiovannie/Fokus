import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/migrations/runner.js', () => ({ verifyMigrations: vi.fn() }))

vi.mock('../src/models/index.js', () => ({
  sequelize: {
    authenticate: vi.fn(),
    sync: vi.fn(),
  },
}))

const { sequelize } = await import('../src/models/index.js')
const { initializeDatabase } = await import('../src/config/initializeDatabase.js')
const { verifyMigrations } = await import('../src/migrations/runner.js')

describe('initializeDatabase', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllEnvs())

  it('valida la conexión antes de sincronizar los modelos sin opciones destructivas', async () => {
    await initializeDatabase()

    expect(sequelize.authenticate).toHaveBeenCalledOnce()
    expect(sequelize.sync).toHaveBeenCalledOnce()
    expect(sequelize.sync).toHaveBeenCalledWith()
    expect(sequelize.authenticate.mock.invocationCallOrder[0]).toBeLessThan(sequelize.sync.mock.invocationCallOrder[0])
  })

  it('no sincroniza si la conexión falla', async () => {
    sequelize.authenticate.mockRejectedValueOnce(new Error('connection failed'))

    await expect(initializeDatabase()).rejects.toThrow('connection failed')
    expect(sequelize.sync).not.toHaveBeenCalled()
  })

  it('en producción verifica migraciones sin ejecutar sync', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await initializeDatabase()
    expect(sequelize.authenticate).toHaveBeenCalledOnce()
    expect(verifyMigrations).toHaveBeenCalledWith(sequelize)
    expect(sequelize.sync).not.toHaveBeenCalled()
  })

  it('rechaza el arranque en producción si el esquema no está preparado', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    verifyMigrations.mockRejectedValueOnce(new Error('migraciones pendientes'))
    await expect(initializeDatabase()).rejects.toThrow('migraciones pendientes')
    expect(sequelize.sync).not.toHaveBeenCalled()
  })
})
