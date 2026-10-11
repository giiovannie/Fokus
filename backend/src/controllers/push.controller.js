import { createHash, randomUUID } from 'node:crypto'
import webPush from 'web-push'
import { UniqueConstraintError } from 'sequelize'
import { PushSubscription } from '../models/index.js'
import { withUserLock } from './notificationPreferences.controller.js'
import { createNotificationPreview } from './notification.controller.js'
import { getPushConfiguration, validatePushSubscription } from '../config/webPush.js'
import { createHttpError } from '../utils/httpError.js'
import { pick } from '../utils/pick.js'

const serialize = row => pick(row, ['id', 'device_id', 'device_label', 'created_at', 'updated_at'])
const configuration = () => {
  let config
  try { config = getPushConfiguration() } catch { throw createHttpError(503, 'La configuración Push del servidor no es válida.') }
  if (!config) throw createHttpError(503, 'Las notificaciones Push todavía no están configuradas.')
  return config
}
export const getPushConfig = (req, res, next) => {
  try {
    const config = getPushConfiguration()
    return res.json({ enabled: !!config, public_key: config?.publicKey || null })
  } catch { return next(createHttpError(503, 'La configuración Push del servidor no es válida.')) }
}
export const listPushSubscriptions = async (req, res, next) => {
  try { return res.json((await PushSubscription.findAll({ where: { user_id: req.user.id }, order: [['id', 'ASC']] })).map(serialize)) }
  catch (error) { return next(error) }
}
export const savePushSubscription = async (req, res, next) => {
  try {
    configuration()
    const saved = await withUserLock(req.user.id, async transaction => {
      const { subscription, device_id, device_label = 'Este navegador' } = req.body
      const endpoint_hash = createHash('sha256').update(subscription.endpoint).digest('hex')
      const existing = await PushSubscription.findOne({ where: { endpoint_hash }, transaction })
      if (existing && existing.user_id !== req.user.id) throw createHttpError(409, 'Esta suscripción ya está vinculada a otra cuenta. Desactivala en ese navegador antes de continuar.')
      if (existing && existing.device_id !== device_id) throw createHttpError(409, 'La suscripción pertenece a otro registro de navegador. Desactivala antes de registrarla de nuevo.')
      const row = await PushSubscription.findOne({ where: { user_id: req.user.id, device_id }, transaction })
      const data = { user_id: req.user.id, device_id, device_label, endpoint: subscription.endpoint, endpoint_hash, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth }
      if (row) return row.update(data, { transaction })
      if (await PushSubscription.count({ where: { user_id: req.user.id }, transaction }) >= 10) throw createHttpError(409, 'Podés registrar hasta 10 dispositivos. Desactivá uno antes de agregar otro.')
      return PushSubscription.create(data, { transaction })
    })
    return res.status(200).json(serialize(saved))
  } catch (error) { return next(error instanceof UniqueConstraintError ? createHttpError(409, 'La suscripción ya está registrada. Volvé a intentar.') : error) }
}
export const deletePushSubscription = async (req, res, next) => {
  try {
    const deleted = await withUserLock(req.user.id, transaction => PushSubscription.destroy({ where: { id: req.params.id, user_id: req.user.id }, transaction }))
    if (!deleted) throw createHttpError(404, 'No encontramos una suscripción propia con ese identificador.')
    return res.sendStatus(204)
  } catch (error) { return next(error) }
}
export const sendPushTest = async (req, res, next) => {
  try {
    const config = configuration()
    // El ID de destino nunca permite salir de la cuenta autenticada.
    const row = await PushSubscription.findOne({ where: { id: req.params.id, user_id: req.user.id } })
    if (!row) throw createHttpError(404, 'No encontramos una suscripción propia con ese identificador.')
    const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }
    if (!validatePushSubscription(subscription)) throw createHttpError(400, 'La suscripción almacenada no es válida. Desactivala y volvé a activarla.')
    const endpointHash = row.endpoint_hash
    const message = await createNotificationPreview(req.user.id, req.body)
    const payload = JSON.stringify({ title: message.title, body: message.body, id: randomUUID(), data: { source: 'fokus', test: true } })
    try {
      await webPush.sendNotification(subscription, payload, { vapidDetails: config, TTL: 60, timeout: 10000, urgency: 'normal' })
    } catch (error) {
      if ([404, 410].includes(error.statusCode)) {
        await PushSubscription.destroy({ where: { id: row.id, user_id: req.user.id, endpoint_hash: endpointHash } })
        throw createHttpError(410, 'La suscripción venció. Volvé a activar las notificaciones Push en ese dispositivo.')
      }
      // Los errores del proveedor pueden contener URL y claves: no propagarlos ni registrarlos.
      throw createHttpError(503, 'No pudimos entregar la prueba al servicio de notificaciones. Intentá nuevamente más tarde.')
    }
    return res.status(202).json({ message: 'El servicio Push aceptó la prueba. La visualización depende del dispositivo y sus permisos.' })
  } catch (error) { return next(error) }
}
