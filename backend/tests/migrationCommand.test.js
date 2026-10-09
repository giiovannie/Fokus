import { afterEach, expect, it, vi } from 'vitest'

vi.mock('dotenv/config', () => ({}))
const { authenticate } = vi.hoisted(() => ({ authenticate: vi.fn() }))
vi.mock('../src/config/database.js', () => ({ sequelize: { authenticate } }))
const originalArguments = [...process.argv]

afterEach(() => {
  process.argv = [...originalArguments]
  process.exitCode = 0
  vi.restoreAllMocks()
  vi.resetModules()
})

it('rechaza up sin confirmación antes de acceder a MySQL', async () => {
  process.argv = ['node', 'migrate.js', 'up']
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  await import('../scripts/migrate.js')
  expect(process.exitCode).toBe(1)
  expect(log).toHaveBeenCalledWith('Para ejecutar migraciones se requiere --confirm')
  expect(authenticate).not.toHaveBeenCalled()
})

it('rechaza comandos destructivos sin acceder a MySQL', async () => {
  process.argv = ['node', 'migrate.js', 'down', '--confirm']
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  await import('../scripts/migrate.js')
  expect(process.exitCode).toBe(1)
  expect(log).toHaveBeenCalledWith('Comando de migraciones inválido')
  expect(authenticate).not.toHaveBeenCalled()
})
