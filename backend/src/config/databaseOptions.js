import { readFileSync } from 'node:fs'
import { X509Certificate } from 'node:crypto'
import { EnvironmentError } from './environment.js'

export const getDatabaseOptions = (env = process.env, readFile = readFileSync) => {
  const enabled = env.DB_SSL === 'true'
  if (env.DB_SSL && !['true', 'false'].includes(env.DB_SSL)) throw new EnvironmentError('DB_SSL')
  if (env.NODE_ENV === 'production' && !enabled) throw new EnvironmentError('DB_SSL')
  let ssl
  if (enabled) {
    if (!env.DB_SSL_CA_PATH?.trim()) throw new EnvironmentError('DB_SSL_CA_PATH')
    let ca
    try {
      ca = readFile(env.DB_SSL_CA_PATH, 'utf8')
      const certificate = new X509Certificate(ca)
      if (!certificate.ca || Date.parse(certificate.validTo) <= Date.now() || Date.parse(certificate.validFrom) > Date.now()) throw new Error()
    } catch {
      throw new EnvironmentError('DB_SSL_CA_PATH')
    }
    ssl = { ca, rejectUnauthorized: true, verifyIdentity: true }
  } else if (env.DB_SSL_CA_PATH) {
    throw new EnvironmentError('DB_SSL')
  }
  return {
    host: env.DB_HOST || 'localhost', port: Number(env.DB_PORT) || 3306,
    dialect: 'mysql', logging: false,
    dialectOptions: ssl ? { ssl } : {},
    define: { underscored: true, timestamps: true },
  }
}
