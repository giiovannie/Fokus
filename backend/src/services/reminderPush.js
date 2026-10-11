import webPush from 'web-push'
import { getPushConfiguration, validatePushSubscription } from '../config/webPush.js'
export const deliverReminder = async (subscription, message, { ttl, timeout, id }) => {
  const config = getPushConfiguration()
  if (!config) throw Object.assign(new Error('Push not configured'), { deliveryCode: 'push_unconfigured' })
  const target = { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }
  if (!validatePushSubscription(target)) throw Object.assign(new Error('Invalid subscription'), { deliveryCode: 'invalid_subscription' })
  try {
    await webPush.sendNotification(target, JSON.stringify({ title: message.title, body: message.body, id, data: { source: 'fokus', test: false } }), { vapidDetails: config, TTL: ttl, timeout, urgency: 'normal' })
  } catch (error) {
    const status = Number(error.statusCode)
    const expired = [404, 410].includes(status)
    const retryable = status === 429 || status >= 500 && status <= 599
    throw Object.assign(new Error('Push delivery failed'), { expired, retryable, deliveryCode: expired ? 'subscription_expired' : retryable ? 'provider_busy' : status >= 400 && status <= 499 ? 'provider_rejected' : 'delivery_uncertain' })
  }
}
