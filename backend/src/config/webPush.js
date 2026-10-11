import { createECDH, ECDH } from 'node:crypto'

const decode = (value, size) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error()
  const bytes = Buffer.from(value, 'base64url')
  if (bytes.length !== size || bytes.toString('base64url') !== value) throw new Error()
  return bytes
}
export const getPushConfiguration = (env = process.env) => {
  const fields = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']
  if (!fields.some(field => env[field])) return null
  try {
    const publicKey = decode(env.VAPID_PUBLIC_KEY, 65)
    const privateKey = decode(env.VAPID_PRIVATE_KEY, 32)
    const ecdh = createECDH('prime256v1'); ecdh.setPrivateKey(privateKey)
    if (!ecdh.getPublicKey().equals(publicKey)) throw new Error()
    const subject = new URL(env.VAPID_SUBJECT)
    if (subject.protocol === 'mailto:') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subject.pathname) || subject.search || subject.hash) throw new Error()
    } else if (subject.protocol !== 'https:' || subject.username || subject.password || subject.hostname === 'localhost') throw new Error()
    return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT }
  } catch {
    // Nunca incluir los valores ni el error criptográfico original.
    throw new Error('Configuración VAPID incompleta o inválida')
  }
}
export const validatePushSubscription = value => {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['endpoint', 'keys', 'expirationTime'].includes(key))) return false
    if (typeof value.endpoint !== 'string' || value.endpoint.length > 2048) return false
    const url = new URL(value.endpoint)
    const knownHost = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname) || url.hostname.endsWith('.notify.windows.com')
    if (!knownHost || url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443')) return false
    if (value.expirationTime != null && (!Number.isSafeInteger(value.expirationTime) || value.expirationTime < 0)) return false
    if (!value.keys || Object.keys(value.keys).some(key => !['p256dh', 'auth'].includes(key))) return false
    const publicKey = decode(value.keys.p256dh, 65)
    if (publicKey[0] !== 4) return false
    ECDH.convertKey(publicKey, 'prime256v1')
    decode(value.keys.auth, 16)
    return true
  } catch { return false }
}
