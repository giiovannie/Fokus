import { isIP } from 'node:net'

export class EnvironmentError extends Error {
  constructor(variable) {
    super(`Configuración inválida: ${variable}`)
    this.name = 'EnvironmentError'
  }
}

export const validateEnvironment = (env = process.env) => {
  const fail = (name) => { throw new EnvironmentError(name) }
  const hasValue = (name) => typeof env[name] === 'string' && env[name].trim() !== ''
  const requireValue = (name) => { if (!hasValue(name)) fail(name) }
  const mode = env.NODE_ENV || 'development'
  if (!['development', 'test', 'production'].includes(mode)) fail('NODE_ENV')
  const production = mode === 'production'
  if (env.TRUST_PROXY_HOPS !== undefined && env.TRUST_PROXY_HOPS !== '' && !['0', '1'].includes(env.TRUST_PROXY_HOPS)) fail('TRUST_PROXY_HOPS')
  if (production) requireValue('TRUST_PROXY_HOPS')
  if (env.DB_SSL && !['true', 'false'].includes(env.DB_SSL)) fail('DB_SSL')
  if (production && env.DB_SSL !== 'true') fail('DB_SSL')
  if (env.DB_SSL === 'true') requireValue('DB_SSL_CA_PATH')
  if (env.DB_SSL_CA_PATH && env.DB_SSL !== 'true') fail('DB_SSL')
  for (const name of ['PORT', 'DB_PORT', 'DB_HOST', 'JWT_EXPIRES_IN', 'FRONTEND_URL', 'CLOUDINARY_REQUIRED', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
    if (env[name] !== undefined && env[name] !== '' && !hasValue(name)) fail(name)
  }

  for (const name of ['DB_NAME', 'DB_USER', 'JWT_SECRET']) requireValue(name)
  if (production) {
    for (const name of ['DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'PORT', 'FRONTEND_URL']) requireValue(name)
    if (env.JWT_SECRET.length < 32) fail('JWT_SECRET')
  }

  for (const name of ['PORT', 'DB_PORT']) {
    if (hasValue(name) && (!/^\d+$/.test(env[name]) || Number(env[name]) < 1 || Number(env[name]) > 65535)) fail(name)
  }
  if (hasValue('DB_HOST') && !isIP(env.DB_HOST) && !/^(?=.{1,253}$)[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)*$/i.test(env.DB_HOST)) fail('DB_HOST')

  if (hasValue('FRONTEND_URL')) {
    let url
    try { url = new URL(env.FRONTEND_URL) } catch { fail('FRONTEND_URL') }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || (production && url.protocol !== 'https:')) fail('FRONTEND_URL')
  }

  // jsonwebtoken interpreta las cadenas de duración mediante ms. Exigir unidad
  // evita que una cadena numérica se interprete accidentalmente en milisegundos.
  if (hasValue('JWT_EXPIRES_IN') && !/^\d+(?:\.\d+)?\s*(?:ms|milliseconds?|s|seconds?|m|minutes?|h|hours?|d|days?|w|weeks?|y|years?)$/i.test(env.JWT_EXPIRES_IN)) fail('JWT_EXPIRES_IN')
  if (hasValue('JWT_EXPIRES_IN') && (parseFloat(env.JWT_EXPIRES_IN) <= 0 || env.JWT_EXPIRES_IN.length > 100)) fail('JWT_EXPIRES_IN')

  if (hasValue('CLOUDINARY_REQUIRED') && !['true', 'false'].includes(env.CLOUDINARY_REQUIRED)) fail('CLOUDINARY_REQUIRED')
  const cloudVariables = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
  if ((production && env.CLOUDINARY_REQUIRED === 'true') || cloudVariables.some(hasValue)) {
    cloudVariables.forEach(requireValue)
    if (!/^[a-z\d_-]+$/i.test(env.CLOUDINARY_CLOUD_NAME)) fail('CLOUDINARY_CLOUD_NAME')
    if (!/^\d+$/.test(env.CLOUDINARY_API_KEY)) fail('CLOUDINARY_API_KEY')
  }

  return { nodeEnv: mode, port: Number(env.PORT) || 3000 }
}
