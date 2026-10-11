import 'dotenv/config'
import { validateEnvironment } from '../src/config/environment.js'
let database
try {
  // Prueba explícita local: nunca adoptar silenciosamente un destino remoto del .env.
  if (!process.argv.includes('--confirm') || !process.argv.includes('--local')) throw new Error('Para procesar localmente se requieren --confirm --local')
  if (process.env.NODE_ENV !== 'development' || process.env.DB_HOST !== '127.0.0.1' || process.env.DB_PORT !== '3306' || process.env.DB_NAME !== 'fokus_web_push_local' || process.env.DB_SSL !== 'false') throw new Error('Destino local no autorizado')
  validateEnvironment()
  ;({ sequelize: database } = await import('../src/models/index.js'))
  await database.authenticate()
  const { runReminderWorker } = await import('../src/services/runReminderWorker.js')
  console.log(JSON.stringify(await runReminderWorker({ localConfirmation: true })))
} catch {
  console.error('No se procesaron más recordatorios. Verificá confirmación local, configuración Push y migraciones pendientes; no compartas secretos.')
  process.exitCode = 1
} finally { if (database) await database.close() }
