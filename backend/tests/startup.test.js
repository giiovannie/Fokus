import { afterEach, expect, it, vi } from 'vitest'

// No leer .env ni conectar una base real durante la comprobación de arranque.
vi.mock('dotenv/config', () => ({}))
vi.mock('../src/config/serverLifecycle.js', () => ({ registerShutdown: vi.fn() }))
const { initializeDatabase, closeDatabase, listen } = vi.hoisted(() => ({ initializeDatabase: vi.fn(), closeDatabase: vi.fn(), listen: vi.fn() }))
vi.mock('../src/config/initializeDatabase.js', () => ({ initializeDatabase, closeDatabase }))
vi.mock('../src/app.js', () => ({ app: { listen } }))

afterEach(() => {
  process.exitCode = 0
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.resetModules()
})

it('impide conectar MySQL y abrir el puerto cuando falta una variable obligatoria', async () => {
  vi.stubEnv('DB_NAME', '')
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  await import('../app.js')
  expect(initializeDatabase).not.toHaveBeenCalled()
  expect(listen).not.toHaveBeenCalled()
  expect(process.exitCode).toBe(1)
  expect(log).toHaveBeenCalledExactlyOnceWith('Configuración inválida: DB_NAME')
})

it('arranca con configuración válida después de inicializar MySQL', async () => {
  const env = {
    NODE_ENV: 'production', DB_NAME: 'test_db', DB_USER: 'test_user',
    DB_PASSWORD: 'test-only-password', DB_HOST: 'localhost', DB_PORT: '3306',
    PORT: '4000', JWT_SECRET: 'x'.repeat(32), FRONTEND_URL: 'https://example.test',
    DB_SSL: 'true', DB_SSL_CA_PATH: '/test-only/ca.pem',
    TRUST_PROXY_HOPS: '1',
    JWT_EXPIRES_IN: '1d', CLOUDINARY_REQUIRED: 'false',
    CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '',
  }
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value)
  listen.mockReturnValue({ once: (event, callback) => { if (event === 'listening') queueMicrotask(callback) } })
  await import('../app.js')
  await vi.waitFor(() => expect(listen).toHaveBeenCalledWith(4000, '0.0.0.0'))
  expect(initializeDatabase).toHaveBeenCalledOnce()
  expect(initializeDatabase.mock.invocationCallOrder[0]).toBeLessThan(listen.mock.invocationCallOrder[0])
})

it('cierra la conexión y no escucha cuando falla la verificación de migraciones', async () => {
  const { MigrationError } = await import('../src/migrations/runner.js')
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('DB_NAME', 'test_db')
  vi.stubEnv('DB_USER', 'test_user')
  vi.stubEnv('JWT_SECRET', 'test-only-secret')
  initializeDatabase.mockRejectedValueOnce(new MigrationError('Hay migraciones pendientes'))
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  await import('../app.js')
  await vi.waitFor(() => expect(closeDatabase).toHaveBeenCalledOnce())
  expect(listen).not.toHaveBeenCalled()
  expect(process.exitCode).toBe(1)
  expect(log).toHaveBeenCalledWith('Hay migraciones pendientes')
})
