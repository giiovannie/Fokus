import { describe, expect, it } from 'vitest'
import { EnvironmentError, validateEnvironment } from '../src/config/environment.js'

const development = () => ({ DB_NAME: 'fokus_test', DB_USER: 'test_user', JWT_SECRET: 'test-only-secret' })
const production = () => ({
  ...development(), NODE_ENV: 'production', DB_PASSWORD: 'test-only-password',
  DB_HOST: 'mysql.example.test', DB_PORT: '3306', PORT: '3000',
  FRONTEND_URL: 'https://fokus.example.test', JWT_SECRET: 'x'.repeat(32),
  DB_SSL: 'true', DB_SSL_CA_PATH: '/test-only/ca.pem',
  TRUST_PROXY_HOPS: '1',
})
const cloud = { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: '123456', CLOUDINARY_API_SECRET: 'test-only-key' }

describe('validateEnvironment', () => {
  it('acepta orígenes adicionales HTTPS explícitos', () => {
    expect(() => validateEnvironment({ ...production(), CORS_ADDITIONAL_ORIGINS: 'https://localhost, https://other.example.test/' })).not.toThrow()
  })
  it.each(['*', 'https://*.example.test', 'https://example.test/path', 'https://example.test?x=1', 'https://example.test#x', 'https://user:password@example.test', 'null', 'https://localhost,', '   ', 'http://localhost'])('rechaza la lista CORS inválida %s en producción', (value) => {
    expect(() => validateEnvironment({ ...production(), CORS_ADDITIONAL_ORIGINS: value })).toThrow('CORS_ADDITIONAL_ORIGINS')
  })
  it('permite orígenes HTTP explícitos en desarrollo', () => {
    expect(() => validateEnvironment({ ...development(), CORS_ADDITIONAL_ORIGINS: 'http://localhost:8080' })).not.toThrow()
  })
  it('conserva los valores predeterminados de desarrollo sin exigir Cloudinary', () => {
    expect(validateEnvironment(development())).toEqual({ nodeEnv: 'development', port: 3000 })
  })
  it('acepta producción sin Cloudinary y configuración de pruebas', () => {
    expect(validateEnvironment(production()).nodeEnv).toBe('production')
    expect(validateEnvironment({ ...development(), NODE_ENV: 'test' }).nodeEnv).toBe('test')
  })
  it.each(['DB_NAME', 'DB_USER', 'JWT_SECRET'])('rechaza %s ausente sin revelar valores', (name) => {
    const env = development()
    delete env[name]
    expect(() => validateEnvironment(env)).toThrow(new EnvironmentError(name))
  })
  it.each(['DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'PORT', 'FRONTEND_URL'])('exige %s en producción', (name) => {
    expect(() => validateEnvironment({ ...production(), [name]: '   ' })).toThrow(`Configuración inválida: ${name}`)
  })
  it.each([
    ['NODE_ENV', 'invalid'], ['PORT', '0'], ['PORT', '65536'], ['PORT', '3.5'],
    ['DB_PORT', '3306abc'], ['DB_HOST', 'https://mysql.test'],
    ['DB_HOST', '   '], ['JWT_EXPIRES_IN', '   '],
    ['FRONTEND_URL', 'invalid'], ['FRONTEND_URL', 'https://user:password@example.test'],
    ['FRONTEND_URL', 'https://example.test/path'], ['FRONTEND_URL', 'https://example.test?x=1'],
    ['JWT_EXPIRES_IN', '0d'], ['JWT_EXPIRES_IN', '3600'], ['JWT_EXPIRES_IN', 'invalid'],
    ['CLOUDINARY_REQUIRED', 'yes'],
    ['DB_SSL', 'yes'],
    ['TRUST_PROXY_HOPS', 'true'], ['TRUST_PROXY_HOPS', '2'],
  ])('rechaza el formato incorrecto de %s', (name, value) => {
    expect(() => validateEnvironment({ ...development(), [name]: value })).toThrow(`Configuración inválida: ${name}`)
  })
  it.each(['1d', '30m', '2 hours', '500ms'])('acepta duración explícita %s', (value) => {
    expect(() => validateEnvironment({ ...development(), JWT_EXPIRES_IN: value })).not.toThrow()
  })
  it('exige HTTPS y longitud mínima del secreto en producción', () => {
    expect(() => validateEnvironment({ ...production(), FRONTEND_URL: 'http://example.test' })).toThrow('FRONTEND_URL')
    expect(() => validateEnvironment({ ...production(), JWT_SECRET: 'short' })).toThrow('JWT_SECRET')
  })
  it('exige TLS y la ruta de CA en producción', () => {
    expect(() => validateEnvironment({ ...production(), DB_SSL: 'false', DB_SSL_CA_PATH: '' })).toThrow('DB_SSL')
    expect(() => validateEnvironment({ ...production(), DB_SSL_CA_PATH: '' })).toThrow('DB_SSL_CA_PATH')
  })
  it('exige Cloudinary solo cuando producción lo requiere o hay configuración parcial', () => {
    expect(() => validateEnvironment({ ...production(), CLOUDINARY_REQUIRED: 'true' })).toThrow('CLOUDINARY_CLOUD_NAME')
    expect(() => validateEnvironment({ ...development(), CLOUDINARY_REQUIRED: 'true' })).not.toThrow()
    expect(() => validateEnvironment({ ...development(), CLOUDINARY_CLOUD_NAME: 'test-cloud' })).toThrow('CLOUDINARY_API_KEY')
    expect(() => validateEnvironment({ ...production(), ...cloud, CLOUDINARY_REQUIRED: 'true' })).not.toThrow()
    expect(() => validateEnvironment({ ...development(), ...cloud, CLOUDINARY_API_KEY: 'invalid' })).toThrow('CLOUDINARY_API_KEY')
    expect(() => validateEnvironment({ ...development(), ...cloud, CLOUDINARY_CLOUD_NAME: 'invalid/name' })).toThrow('CLOUDINARY_CLOUD_NAME')
  })
})
