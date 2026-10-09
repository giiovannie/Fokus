import 'dotenv/config'
import { EnvironmentError, validateEnvironment } from './src/config/environment.js'
import { MigrationError } from './src/migrations/runner.js'
import { registerShutdown } from './src/config/serverLifecycle.js'

const startServer = async () => {
  let closeDatabase
  try {
    const { port } = validateEnvironment()
    const { app } = await import('./src/app.js')
    const database = await import('./src/config/initializeDatabase.js')
    closeDatabase = database.closeDatabase
    const { initializeDatabase } = database
    await initializeDatabase()
    const server = app.listen(port, '0.0.0.0')
    registerShutdown({ server, closeDatabase, app })
    await new Promise((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })
    console.log(`Servidor iniciado en el puerto ${port}`)
  } catch (error) {
    console.error(error instanceof EnvironmentError || error instanceof MigrationError ? error.message : 'No se pudo iniciar el servicio')
    process.exitCode = 1
    if (closeDatabase) {
      try { await closeDatabase() } catch { console.error('No se pudo cerrar la conexión con la base de datos') }
    }
  }
}

startServer()
