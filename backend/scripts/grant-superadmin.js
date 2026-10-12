// Ejecutar manualmente, después de aplicar la migración de roles.
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
const run = async () => {
  let sequelize, input
  try {
    const args = process.argv.slice(2)
    const position = args.indexOf('--user-id')
    const userId = Number(args[position + 1])
    if (position < 0 || !Number.isSafeInteger(userId) || userId < 1 || !args.includes('--confirm') || !args.includes('--identity-verified') || !process.stdin.isTTY) {
      throw new Error('Se requiere terminal interactiva, --user-id, --identity-verified y --confirm')
    }
    // No leer .env: el operador provee configuración de conexión en el proceso.
    const remote = process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST || 'localhost')
    if (remote && (!args.includes('--confirm-production') || process.env.DB_SSL !== 'true')) throw new Error('Falta confirmación remota o TLS verificado')
    const { validateEnvironment } = await import('../src/config/environment.js')
    validateEnvironment()
    ;({ sequelize } = await import('../src/models/index.js'))
    const { verifyMigrations } = await import('../src/migrations/runner.js')
    await sequelize.authenticate(); await verifyMigrations(sequelize)
    const muted = new Writable({ write(_chunk, _encoding, callback) { callback() } })
    input = createInterface({ input: process.stdin, output: muted, terminal: true })
    process.stdout.write('Contraseña actual de la cuenta administradora (oculta): ')
    const password = await input.question('')
    process.stdout.write('\n')
    const { assignSuperadmin } = await import('../src/services/superadminAssignment.js')
    await assignSuperadmin({ userId, password, confirmed: true, identityVerified: true })
    console.log('Rol superadmin asignado a la cuenta existente y verificada. Volvé a iniciar sesión.')
  } catch {
    console.error('No se asignó el rol. Revisá identidad, configuración y confirmaciones sin compartir credenciales.')
    process.exitCode = 1
  } finally {
    input?.close()
    if (sequelize) { try { await sequelize.close() } catch { console.error('No se pudo cerrar la conexión de asignación.'); process.exitCode = 1 } }
  }
}
run()
