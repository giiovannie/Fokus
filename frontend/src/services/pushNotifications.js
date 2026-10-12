import { deletePushSubscription, savePushSubscription } from './notifications.service.js'
import { getSession } from '../utils/authSession.js'

const DEVICE_KEY = 'fokus-push-device'
const OWNER_KEY = 'fokus-push-owner'
const fingerprint = async subscription => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(subscription.toJSON())))
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')
}
export const getPushDeviceId = () => {
  let id = window.localStorage.getItem(DEVICE_KEY)
  if (!id && typeof globalThis.crypto?.randomUUID !== 'function') return null
  if (!id) { id = crypto.randomUUID(); window.localStorage.setItem(DEVICE_KEY, id) }
  return id
}
const applicationKey = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), character => character.charCodeAt(0))
const assertSupport = () => {
  if (!globalThis.isSecureContext) throw new Error('Abrí Fokus con HTTPS o en localhost para activar notificaciones.')
  if (!globalThis.Notification || !navigator.serviceWorker || !globalThis.PushManager) throw new Error('Este navegador no admite notificaciones Push. Podés seguir usando la vista previa.')
}
const waitForWorker = async registration => {
  if (registration.active) return registration
  const worker = registration.installing || registration.waiting
  if (!worker) throw new Error('No pudimos activar las notificaciones. Recargá Fokus y volvé a intentar.')
  await new Promise((resolve, reject) => {
    const done = error => {
      clearTimeout(timer); worker.removeEventListener('statechange', changed)
      if (error) reject(error)
      else resolve()
    }
    const changed = () => {
      if (worker.state === 'activated') done()
      if (worker.state === 'redundant') done(new Error('No pudimos activar las notificaciones. Recargá Fokus y volvé a intentar.'))
    }
    const timer = setTimeout(() => done(new Error('La activación tardó demasiado. Recargá Fokus y volvé a intentar.')), 15000)
    worker.addEventListener('statechange', changed); changed()
  })
  return registration
}
export const activatePush = async (publicKey, label) => {
  assertSupport()
  if (!publicKey) throw new Error('El servidor todavía no tiene configuradas las notificaciones Push.')
  let permission = Notification.permission
  // Solicitar permiso dentro del gesto del usuario, antes de otras esperas.
  if (permission === 'default') permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Las notificaciones están bloqueadas. Permitilas en la configuración del sitio y volvé a intentar.')
  const registration = await waitForWorker(await navigator.serviceWorker.getRegistration() || await navigator.serviceWorker.register('/sw.js'))
  let old
  try { old = JSON.parse(window.localStorage.getItem(OWNER_KEY) || 'null') } catch { old = null }
  const userId = getSession()?.user.id
  if (!userId) throw new Error('Iniciá sesión nuevamente antes de activar notificaciones.')
  let subscription = await registration.pushManager.getSubscription()
  const expectedKey = applicationKey(publicKey)
  const storedKey = subscription?.options?.applicationServerKey
  const differentKey = storedKey && (storedKey.byteLength !== expectedKey.byteLength || new Uint8Array(storedKey).some((value, index) => value !== expectedKey[index]))
  if (subscription && ((old && old.user_id !== userId) || differentKey)) {
    if (!await subscription.unsubscribe()) throw new Error('No pudimos desvincular la suscripción anterior. Volvé a intentar.')
    subscription = null
  }
  const created = !subscription
  if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: expectedKey })
  try {
    const saved = await savePushSubscription({ device_id: getPushDeviceId(), device_label: label.trim() || 'Este navegador', subscription: subscription.toJSON() })
    window.localStorage.setItem(OWNER_KEY, JSON.stringify({ id: saved.id, user_id: userId, fingerprint: await fingerprint(subscription) }))
    return saved
  } catch (error) {
    if (created || error.status === 409) await subscription.unsubscribe().catch(() => false)
    throw error
  }
}
// Sin gesto del usuario solo reconciliar una suscripción que ya existe.
// Nunca pedir permiso ni crear otra suscripción en esta revisión.
export const synchronizePush = async (publicKey, devices) => {
  const userId = getSession()?.user.id
  const own = devices.find(device => device.device_id === getPushDeviceId())
  const permission = globalThis.Notification?.permission
  const registration = await navigator.serviceWorker?.getRegistration?.()
  const local = await registration?.pushManager?.getSubscription()
  if (!userId) throw new Error('Iniciá sesión nuevamente para revisar las notificaciones.')
  if (permission !== 'granted' || !local || (local.expirationTime && local.expirationTime <= Date.now())) {
    if (own) await deactivatePush(own.id)
    else if (local) {
      if (!await local.unsubscribe()) throw new Error('No pudimos desvincular la suscripción anterior. Volvé a intentar.')
      localStorage.removeItem(OWNER_KEY)
    }
    return null
  }
  let owner
  try { owner = JSON.parse(localStorage.getItem(OWNER_KEY) || 'null') } catch { owner = null }
  const expected = applicationKey(publicKey), key = local.options?.applicationServerKey
  const differentKey = key && (key.byteLength !== expected.byteLength || new Uint8Array(key).some((value, index) => value !== expected[index]))
  if ((owner && owner.user_id !== userId) || differentKey) {
    if (!await local.unsubscribe()) throw new Error('No pudimos desvincular la suscripción anterior. Volvé a intentar.')
    if (own) await deletePushSubscription(own.id)
    localStorage.removeItem(OWNER_KEY)
    return null
  }
  const currentFingerprint = await fingerprint(local)
  if (own && owner?.id === own.id && owner.fingerprint === currentFingerprint) return own
  // Recuperar en el backend el vínculo perdido, sin volver a suscribir el navegador.
  try {
    const saved = await savePushSubscription({ device_id: getPushDeviceId(), device_label: own?.device_label || 'Este navegador', subscription: local.toJSON() })
    localStorage.setItem(OWNER_KEY, JSON.stringify({ id: saved.id, user_id: userId, fingerprint: currentFingerprint }))
    return saved
  } catch (error) {
    if (error.status === 409) await local.unsubscribe().catch(() => false)
    throw error
  }
}
// Una baja local evita avisos en un navegador compartido incluso si la API no responde.
export const deactivatePush = async id => {
  const registration = await navigator.serviceWorker?.getRegistration?.()
  const subscription = await registration?.pushManager?.getSubscription()
  if (subscription && !await subscription.unsubscribe()) throw new Error('No pudimos desactivar las notificaciones en este navegador. Volvé a intentar.')
  try { await deletePushSubscription(id) }
  catch (error) { if (error.status !== 404) throw error }
  window.localStorage.removeItem(OWNER_KEY)
}
export const cleanupPushOnLogout = async () => {
  let owner
  try { owner = JSON.parse(window.localStorage.getItem(OWNER_KEY) || 'null') } catch { owner = null }
  const registration = await navigator.serviceWorker?.getRegistration?.()
  const subscription = await registration?.pushManager?.getSubscription()
  for (const notice of await registration?.getNotifications?.() || []) {
    if (notice.data?.source === 'fokus' || notice.data?.test === true) notice.close()
  }
  const unsubscribed = !subscription || await subscription.unsubscribe()
  if (!owner || owner.user_id !== getSession()?.user.id) {
    if (!unsubscribed) throw new Error('No pudimos desactivar los avisos antes de cerrar sesión. Volvé a intentar.')
    window.localStorage.removeItem(OWNER_KEY)
    return
  }
  try { await deletePushSubscription(owner.id) }
  catch (error) {
    if (!unsubscribed && error.status !== 404) throw new Error('No pudimos desactivar los avisos antes de cerrar sesión. Volvé a intentar con conexión.')
  }
  window.localStorage.removeItem(OWNER_KEY)
}

// La cuenta ya se borró en el servidor: no intentar bajas con su JWT revocado.
export const cleanupPushAfterAccountDeletion = async userId => {
  const stillOwnSession = () => !getSession() || getSession().user.id === userId
  if (!stillOwnSession()) return
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.()
    if (!stillOwnSession()) return
    for (const notice of await registration?.getNotifications?.() || []) {
      if (!stillOwnSession()) return
      if (notice.data?.source === 'fokus' || notice.data?.test === true) notice.close()
    }
    const subscription = await registration?.pushManager?.getSubscription()
    if (stillOwnSession()) await subscription?.unsubscribe()
  } catch { /* No quedan suscripciones del usuario eliminado en el backend. */ }
  if (stillOwnSession()) window.localStorage.removeItem(OWNER_KEY)
}
