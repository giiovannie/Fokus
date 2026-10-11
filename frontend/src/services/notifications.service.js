import { apiRequest } from './api.js'

export const getNotifications = () => apiRequest('/notifications')

export const getNotificationPreferences = () => apiRequest('/notifications/preferences')
export const saveNotificationPreferences = values => apiRequest('/notifications/preferences', { method: 'PUT', body: JSON.stringify(values) })
export const getNotificationRules = () => apiRequest('/notifications/rules')
export const createNotificationRule = values => apiRequest('/notifications/rules', { method: 'POST', body: JSON.stringify(values) })
export const updateNotificationRule = (id, values) => apiRequest('/notifications/rules/' + id, { method: 'PUT', body: JSON.stringify(values) })
export const deleteNotificationRule = id => apiRequest('/notifications/rules/' + id, { method: 'DELETE' })

export const getNotificationPhrases = () => apiRequest('/notifications/phrases')
export const createNotificationPhrase = values => apiRequest('/notifications/phrases', { method: 'POST', body: JSON.stringify(values) })
export const updateNotificationPhrase = (id, values) => apiRequest('/notifications/phrases/' + id, { method: 'PUT', body: JSON.stringify(values) })
export const deleteNotificationPhrase = id => apiRequest('/notifications/phrases/' + id, { method: 'DELETE' })

export const getNotificationPreview = values => apiRequest('/notifications/preview', { method: 'POST', body: JSON.stringify(values) })

export const getPushConfig = () => apiRequest('/notifications/push/config')
export const getPushSubscriptions = () => apiRequest('/notifications/push/subscriptions')
export const savePushSubscription = values => apiRequest('/notifications/push/subscriptions', { method: 'POST', body: JSON.stringify(values) })
export const deletePushSubscription = id => apiRequest('/notifications/push/subscriptions/' + id, { method: 'DELETE' })
export const sendPushTest = (id, values) => apiRequest('/notifications/push/test/' + id, { method: 'POST', body: JSON.stringify(values) })
