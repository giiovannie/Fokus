export const registerShutdown = ({ server, closeDatabase, app, processRef = process, timeoutMs = 25000 }) => {
  let shutdownPromise
  const shutdown = () => {
    if (shutdownPromise) return shutdownPromise
    app.locals.shuttingDown = true
    shutdownPromise = (async () => {
      const deadline = setTimeout(() => {
        server.closeAllConnections?.()
        processRef.exit(1)
      }, timeoutMs)
      deadline.unref?.()
      try {
        await new Promise((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve())
          server.closeIdleConnections?.()
        })
      } catch {
        console.error('No se pudo completar el cierre del servicio')
        processRef.exitCode = 1
      } finally {
        try { await closeDatabase() } catch {
          console.error('No se pudo cerrar la conexión con la base de datos')
          processRef.exitCode = 1
        }
        clearTimeout(deadline)
        processRef.removeListener('SIGTERM', shutdown)
        processRef.removeListener('SIGINT', shutdown)
      }
    })()
    return shutdownPromise
  }
  processRef.on('SIGTERM', shutdown)
  processRef.on('SIGINT', shutdown)
  return shutdown
}

// Lista cerrada: no registrar message/stack/SQL/objetos de conexión.
export const formatStartupError = (error, { stage, port } = {}) => {
  const reasons = {
    EADDRINUSE: 'El puerto HTTP ya está ocupado por otro proceso',
    EACCES: 'El sistema rechazó el acceso al puerto o recurso',
    ECONNREFUSED: 'La conexión fue rechazada; comprobá que MariaDB esté iniciado',
    ETIMEDOUT: 'La conexión excedió el tiempo de espera',
    EHOSTUNREACH: 'El servidor no es accesible',
    ENOTFOUND: 'No se pudo resolver la dirección del servidor',
    ER_ACCESS_DENIED_ERROR: 'MariaDB rechazó la autenticación; revisá las credenciales configuradas',
    ER_BAD_DB_ERROR: 'La base de datos configurada no existe',
    ER_TABLEACCESS_DENIED_ERROR: 'El usuario no tiene permisos para acceder a una tabla',
    ER_NO_SUCH_TABLE: 'Falta una tabla requerida',
    ERR_MODULE_NOT_FOUND: 'Falta un módulo o dependencia necesaria',
    MODULE_NOT_FOUND: 'Falta un módulo o dependencia necesaria',
    ERR_DLOPEN_FAILED: 'No se pudo cargar una dependencia nativa',
  }
  const code = [error?.code, error?.original?.code, error?.parent?.code, error?.cause?.code].find(value => typeof value === 'string' && Object.hasOwn(reasons, value))
  const stages = { configuration: 'validación de configuración', modules: 'carga de módulos', database: 'conexión y verificación de la base', listen: 'apertura del puerto HTTP' }
  const context = stages[stage] ? ` durante ${stages[stage]}` : ''
  const portText = stage === 'listen' && Number.isInteger(port) && port >= 1 && port <= 65535 ? ` (puerto ${port})` : ''
  return `No se pudo iniciar el servicio${context}${portText}: ${code || 'ERROR_NO_CLASIFICADO'}. ${code ? reasons[code] : 'Revisá la etapa indicada; los detalles sensibles se omiten.'}`
}
