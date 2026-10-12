// Ejecutar manualmente, después de aplicar la migración de roles.
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { pathToFileURL } from 'node:url'

const safeCodes = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ER_ACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR', 'ER_COLUMNACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN'])
const safeVariables = new Set(['NODE_ENV','TRUST_PROXY_HOPS','DB_SSL','DB_SSL_CA_PATH','DB_NAME','DB_USER','DB_PASSWORD','DB_HOST','DB_PORT','PORT','FRONTEND_URL','JWT_SECRET','JWT_EXPIRES_IN','CLOUDINARY_REQUIRED','CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET','NOTIFICATION_WORKER','VAPID','CORS_ADDITIONAL_ORIGINS'])
export const formatGrantError = (error, stage) => {
  const raw = error?.original?.code ?? error?.parent?.code ?? error?.code
  const variable = error?.name === 'EnvironmentError' ? error.message?.split(': ').at(-1) : null
  const code = safeCodes.has(raw) ? raw : safeVariables.has(variable) ? 'INVALID_' + variable
    : error?.name === 'MigrationError' ? 'MIGRATION_VERIFICATION_FAILED'
    : stage === 'arguments' ? 'CONFIRMATION_OR_TERMINAL_REQUIRED'
    : stage === 'authorization' ? 'PRODUCTION_CONFIRMATION_OR_TLS_REQUIRED'
    : stage === 'post_verification' ? 'ROLE_VERIFICATION_FAILED'
    : stage === 'identity' ? 'ACCOUNT_IDENTITY_REJECTED'
    : stage === 'assignment' && error?.status === 403 ? 'IDENTITY_OR_PASSWORD_REJECTED' : 'VALIDATION_FAILED'
  return JSON.stringify({ stage, code })
}
export const verifyAssignedRole = async (User, userId, approvedEmail) => {
  const result = await User.findByPk(userId, { attributes: ['id', 'email', 'role'] })
  if (!result || result.id !== userId || result.email.toLowerCase() !== approvedEmail || result.role !== 'superadmin') throw new Error('Role verification failed')
}

const run = async () => {
  let sequelize, input, stage = 'arguments'
  try {
    const args = process.argv.slice(2)
    const position = args.indexOf('--user-id')
    const userId = Number(args[position + 1])
    if (position < 0 || !Number.isSafeInteger(userId) || userId < 1 || !args.includes('--confirm') || !args.includes('--identity-verified') || !process.stdin.isTTY) {
      throw new Error('Se requiere terminal interactiva, --user-id, --identity-verified y --confirm')
    }
    // No leer .env: el operador provee configuración de conexión en el proceso.
    stage = 'authorization'
    const remote = process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST || 'localhost')
    if (remote && (!args.includes('--confirm-production') || process.env.DB_SSL !== 'true')) throw new Error('Falta confirmación remota o TLS verificado')
    stage = 'configuration'
    const { validateEnvironment } = await import('../src/config/environment.js')
    validateEnvironment()
    stage = 'tls_and_modules'
    ;({ sequelize } = await import('../src/models/index.js'))
    const { verifyMigrations } = await import('../src/migrations/runner.js')
    stage = 'connection'
    await sequelize.authenticate()
    stage = 'migrations'
    await verifyMigrations(sequelize)
    stage = 'identity'
    const { User } = await import('../src/models/index.js')
    const { approvedAdminEmail } = await import('../src/services/superadminAssignment.js')
    const account = await User.findByPk(userId, { attributes: ['id', 'email'] })
    if (!account || account.email.toLowerCase() !== approvedAdminEmail) throw new Error('Identity rejected')
    if (args.includes('--check-only')) { console.log('Configuración, TLS, conexión e historial verificados; no se asignó ningún rol.'); return }
    stage = 'password_prompt'
    const muted = new Writable({ write(_chunk, _encoding, callback) { callback() } })
    input = createInterface({ input: process.stdin, output: muted, terminal: true })
    process.stdout.write('Contraseña actual de la cuenta administradora (oculta): ')
    const password = await input.question('')
    process.stdout.write('\n')
    const { assignSuperadmin } = await import('../src/services/superadminAssignment.js')
    stage = 'assignment'
    await assignSuperadmin({ userId, password, confirmed: true, identityVerified: true })
    stage = 'post_verification'
    await verifyAssignedRole(User, userId, approvedAdminEmail)
    console.log('Rol superadmin asignado y comprobado a la cuenta existente y verificada. Volvé a iniciar sesión.')
  } catch (error) {
    console.error(formatGrantError(error, stage))
    process.exitCode = 1
  } finally {
    input?.close()
    if (sequelize) { try { await sequelize.close() } catch (error) { console.error(formatGrantError(error, 'close')); process.exitCode = 1 } }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run()
