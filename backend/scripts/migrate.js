import 'dotenv/config'
import { EnvironmentError, validateEnvironment } from '../src/config/environment.js'
import { MigrationError, migrate, migrationStatus, verifyMigrations } from '../src/migrations/runner.js'

const run = async () => {
  let sequelize
  try {
    const command = process.argv[2]
    if (!['up', 'status', 'verify'].includes(command)) throw new MigrationError('Comando de migraciones inválido')
    // Ningún cambio de esquema sin confirmación explícita del operador.
    if (command === 'up' && !process.argv.includes('--confirm')) throw new MigrationError('Para ejecutar migraciones se requiere --confirm')
    validateEnvironment()
    ;({ sequelize } = await import('../src/config/database.js'))
    await sequelize.authenticate()
    if (command === 'up') await migrate(sequelize)
    if (command === 'verify') await verifyMigrations(sequelize)
    if (command === 'status') {
      const { applied, pending } = await migrationStatus(sequelize)
      console.log(JSON.stringify({ applied: applied.map((item) => item.name), pending: pending.map((item) => item.name) }, null, 2))
    } else console.log('Migraciones verificadas correctamente')
  } catch (error) {
    console.error(error instanceof EnvironmentError || error instanceof MigrationError ? error.message : 'Falló la operación de migraciones; revisar conexión y esquema sin compartir credenciales')
    process.exitCode = 1
  } finally {
    if (sequelize) {
      try { await sequelize.close() } catch {
        console.error('No se pudo cerrar la conexión con la base de datos')
        process.exitCode = 1
      }
    }
  }
}

run()
