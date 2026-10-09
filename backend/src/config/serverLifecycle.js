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
