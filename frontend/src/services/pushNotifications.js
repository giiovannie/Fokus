import { deletePushSubscription, savePushSubscription } from './notifications.service.js'
import { getSession } from '../utils/authSession.js'

const DEVICE_KEY = 'fokus-push-device'
const OWNER_KEY = 'fokus-push-owner'
export const REMINDER_CREATED_EVENT = 'fokus:reminder-created'
export const PUSH_PREFERENCES_EVENT = 'fokus:push-preferences'
const choiceKey = id => 'fokus-push-choice:' + id
export const getPushChoice = id => {
  const choice = localStorage.getItem(choiceKey(id))
  if (choice) return choice
  try {
    if (JSON.parse(localStorage.getItem(OWNER_KEY) || 'null')?.user_id === id) {
      localStorage.setItem(choiceKey(id), 'authorized')
      return 'authorized'
    }
  } catch { /* Metadata antigua inválida. */ }
  return null
}
export const setPushChoice = (id, choice) => localStorage.setItem(choiceKey(id), choice)
const rejectedKey = id => 'fokus-push-rejected:' + id
const assertSession = id => {
  if (getSession()?.user.id !== id) throw new Error('La sesión cambió. Volvé a ingresar para revisar tus avisos.')
}
let synchronizing
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
export const activatePush = async (publicKey, label, { requestPermission = true } = {}) => {
  assertSupport()
  if (!publicKey) throw new Error('El servidor todavía no tiene configuradas las notificaciones Push.')
  let permission = Notification.permission
  // Solicitar permiso dentro del gesto del usuario, antes de otras esperas.
  const userId = getSession()?.user.id
  if (!userId) throw new Error('Iniciá sesión nuevamente antes de activar notificaciones.')
  if (permission === 'default' && requestPermission) permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Las notificaciones están bloqueadas. Permitilas en la configuración del sitio y volvé a intentar.')
  const registration = await waitForWorker(await navigator.serviceWorker.getRegistration() || await navigator.serviceWorker.register('/sw.js'))
  let old
  try { old = JSON.parse(window.localStorage.getItem(OWNER_KEY) || 'null') } catch { old = null }
  assertSession(userId)
  let subscription = await registration.pushManager.getSubscription()
  const expectedKey = applicationKey(publicKey)
  const storedKey = subscription?.options?.applicationServerKey
  const differentKey = storedKey && (storedKey.byteLength !== expectedKey.byteLength || new Uint8Array(storedKey).some((value, index) => value !== expectedKey[index]))
  if (subscription && ((old && old.user_id !== userId) || differentKey)) {
    if (!await subscription.unsubscribe()) throw new Error('No pudimos desvincular la suscripción anterior. Volvé a intentar.')
    subscription = null
  }
  const created = !subscription
  const options = { userVisibleOnly: true, applicationServerKey: expectedKey }
  if (!requestPermission && registration.pushManager.permissionState && await registration.pushManager.permissionState(options) !== 'granted') {
    throw new DOMException('Revisá el permiso de notificaciones de este dispositivo.', 'NotAllowedError')
  }
  assertSession(userId)
  if (!subscription) subscription = await registration.pushManager.subscribe(options)
  try {
    assertSession(userId)
    const currentFingerprint = await fingerprint(subscription)
    if (localStorage.getItem(rejectedKey(userId)) === currentFingerprint) {
      throw Object.assign(new Error('Este dispositivo necesita actualizar el permiso de notificaciones. Revisalo en la configuración del navegador.'), { status: 410 })
    }
    assertSession(userId)
    const saved = await savePushSubscription({ device_id: getPushDeviceId(), device_label: label.trim() || 'Este navegador', subscription: subscription.toJSON() })
    assertSession(userId)
    window.localStorage.setItem(OWNER_KEY, JSON.stringify({ id: saved.id, user_id: userId, fingerprint: currentFingerprint }))
    setPushChoice(userId, 'authorized')
    return saved
  } catch (error) {
    if (created || [409, 410].includes(error.status)) {
      if (error.status === 410) localStorage.setItem(rejectedKey(userId), await fingerprint(subscription))
      await subscription.unsubscribe().catch(() => false)
      if (getSession()?.user.id === userId) window.localStorage.removeItem(OWNER_KEY)
    }
    throw error
  }
}
// Una renovación automática requiere autorización previa y nunca solicita permiso.
const reconcilePush = async (publicKey, devices, { allowRenewal = false } = {}) => {
  const userId = getSession()?.user.id
  const own = devices.find(device => device.device_id === getPushDeviceId())
  const permission = globalThis.Notification?.permission
  const registration = await navigator.serviceWorker?.getRegistration?.()
  const local = await registration?.pushManager?.getSubscription()
  if (!userId) throw new Error('Iniciá sesión nuevamente para revisar las notificaciones.')
  assertSession(userId)
  const authorized = getPushChoice(userId) === 'authorized'
  const renew = () => allowRenewal && authorized && globalThis.Notification?.permission === 'granted' && getPushChoice(userId) === 'authorized'
    ? activatePush(publicKey, own?.device_label || 'Este dispositivo', { requestPermission: false }) : null
  if (permission !== 'granted' || !local || (local.expirationTime && local.expirationTime <= Date.now())) {
    if (own) await deactivatePush(own.id)
    else if (local) {
      if (!await local.unsubscribe()) throw new Error('No pudimos desvincular la suscripción anterior. Volvé a intentar.')
      localStorage.removeItem(OWNER_KEY)
    }
    return renew()
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
  assertSession(userId)
  if (localStorage.getItem(rejectedKey(userId)) === currentFingerprint) {
    if (!await local.unsubscribe()) throw new Error('No pudimos actualizar tus avisos. Revisá el permiso del navegador.')
    localStorage.removeItem(OWNER_KEY)
    return renew()
  }
  if (own && owner?.id === own.id && owner.fingerprint === currentFingerprint) return own
  // Recuperar en el backend el vínculo perdido, sin volver a suscribir el navegador.
  try {
    const saved = await savePushSubscription({ device_id: getPushDeviceId(), device_label: own?.device_label || 'Este navegador', subscription: local.toJSON() })
    assertSession(userId)
    localStorage.setItem(OWNER_KEY, JSON.stringify({ id: saved.id, user_id: userId, fingerprint: currentFingerprint }))
    return saved
  } catch (error) {
    if (error.status === 410) {
      localStorage.setItem(rejectedKey(userId), currentFingerprint)
      if (!await local.unsubscribe()) throw new Error('No pudimos retirar la suscripción vencida. Volvé a intentar.')
      localStorage.removeItem(OWNER_KEY)
      return renew()
    }
    if (error.status === 409) {
      if (!await local.unsubscribe()) throw new Error('No pudimos desvincular la suscripción anterior. Volvé a intentar.')
      localStorage.removeItem(OWNER_KEY)
    }
    throw error
  }
}
export const synchronizePush = (publicKey, devices, options) => {
  if (synchronizing) return synchronizing
  synchronizing = reconcilePush(publicKey, devices, options).finally(() => { synchronizing = null })
  return synchronizing
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
  // Terminar un registro en curso antes de retirar el dispositivo de la cuenta.
  if (synchronizing) await synchronizing.catch(() => {})
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
