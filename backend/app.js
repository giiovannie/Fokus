import 'dotenv/config'
import { EnvironmentError, validateEnvironment } from './src/config/environment.js'
import { MigrationError } from './src/migrations/runner.js'
import { formatStartupError, registerShutdown } from './src/config/serverLifecycle.js'

const startServer = async () => {
  let closeDatabase
  let stage = 'configuration'
  let port
  try {
    ;({ port } = validateEnvironment())
    stage = 'modules'
    const { app } = await import('./src/app.js')
    const database = await import('./src/config/initializeDatabase.js')
    closeDatabase = database.closeDatabase
    const { initializeDatabase } = database
    stage = 'database'
    await initializeDatabase()
    stage = 'listen'
    const server = app.listen(port, '0.0.0.0')
    registerShutdown({ server, closeDatabase, app })
    await new Promise((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })
    console.log(`Servidor iniciado en el puerto ${port}`)
  } catch (error) {
    console.error(error instanceof EnvironmentError || error instanceof MigrationError ? error.message : formatStartupError(error, { stage, port }))
    process.exitCode = 1
    if (closeDatabase) {
      try { await closeDatabase() } catch { console.error('No se pudo cerrar la conexión con la base de datos') }
    }
  }
}

startServer()
