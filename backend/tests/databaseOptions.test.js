import { rootCertificates } from 'node:tls'
import { X509Certificate } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { getDatabaseOptions } from '../src/config/databaseOptions.js'

const ca = rootCertificates.find((pem) => {
  const cert = new X509Certificate(pem)
  return cert.ca && Date.parse(cert.validTo) > Date.now() && Date.parse(cert.validFrom) < Date.now()
})
const env = { NODE_ENV: 'production', DB_SSL: 'true', DB_SSL_CA_PATH: '/test/ca.pem', DB_HOST: 'mysql.example.test', DB_PORT: '12345' }

describe('opciones MySQL y TLS', () => {
  it('conserva conexión local sin TLS en desarrollo', () => {
    const read = vi.fn()
    expect(getDatabaseOptions({}, read)).toMatchObject({ host: 'localhost', port: 3306, dialectOptions: {} })
    expect(read).not.toHaveBeenCalled()
  })
  it('valida CA y habilita verificación del certificado y hostname', () => {
    const read = vi.fn(() => ca)
    expect(getDatabaseOptions(env, read)).toMatchObject({
      host: env.DB_HOST, port: 12345,
      dialectOptions: { ssl: { ca, rejectUnauthorized: true, verifyIdentity: true } },
    })
    expect(read).toHaveBeenCalledWith('/test/ca.pem', 'utf8')
  })
  it('rechaza producción sin TLS y evita ignorar una CA configurada', () => {
    expect(() => getDatabaseOptions({ NODE_ENV: 'production' })).toThrow('DB_SSL')
    expect(() => getDatabaseOptions({ DB_SSL: 'false', DB_SSL_CA_PATH: '/test/ca.pem' })).toThrow('DB_SSL')
  })
  it('rechaza certificados ausentes, ilegibles o inválidos sin mostrar valores', () => {
    expect(() => getDatabaseOptions({ ...env, DB_SSL_CA_PATH: '' })).toThrow('DB_SSL_CA_PATH')
    expect(() => getDatabaseOptions(env, () => { throw new Error('sensitive path') })).toThrow('Configuración inválida: DB_SSL_CA_PATH')
    expect(() => getDatabaseOptions(env, () => 'not-a-certificate')).toThrow('Configuración inválida: DB_SSL_CA_PATH')
  })
  it('rechaza una CA vencida', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(new X509Certificate(ca).validTo) + 1000)
    try {
      expect(() => getDatabaseOptions(env, () => ca)).toThrow('Configuración inválida: DB_SSL_CA_PATH')
    } finally { clock.mockRestore() }
  })
})
