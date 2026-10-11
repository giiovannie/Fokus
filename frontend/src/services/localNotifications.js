// Esta prueba no registra suscripciones ni envíos remotos.
export const sendLocalNotification = async (message, {
  notification = globalThis.Notification,
  serviceWorker = globalThis.navigator?.serviceWorker,
  secure = globalThis.isSecureContext,
} = {}) => {
  if (!secure) throw new Error('Abrí Fokus en una conexión segura o en localhost para probar notificaciones.')
  if (!notification) throw new Error('Este navegador no admite notificaciones. Podés usar la vista previa.')
  let permission = notification.permission
  if (permission === 'default') permission = await notification.requestPermission()
  if (permission !== 'granted') throw new Error('Las notificaciones están bloqueadas. Permitilas en la configuración del sitio de Chrome y volvé a probar.')
  const options = { body: message.body, icon: '/icons/fokus-192.png', badge: '/icons/fokus-192.png', data: { test: true, url: '/notifications/preferences' } }
  try {
    const registration = await serviceWorker?.getRegistration?.()
    if (registration?.active && typeof registration.showNotification === 'function') {
      await registration.showNotification(message.title, options)
      return
    }
    const instance = new notification(message.title, options)
    // El constructor puede devolver antes de que el sistema rechace el aviso.
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('No pudimos confirmar el aviso. Revisá los permisos y la configuración de notificaciones del dispositivo.')), 5000)
      instance.onshow = () => { clearTimeout(timer); resolve() }
      instance.onerror = () => { clearTimeout(timer); reject(new Error('No pudimos mostrar el aviso en este dispositivo. La vista previa sigue disponible.')) }
    })
  } catch {
    throw new Error('No pudimos mostrar el aviso en este dispositivo. Revisá los permisos y las notificaciones de Windows. La vista previa sigue disponible.')
  }
}
