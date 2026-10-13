import { apiRequest } from './api.js'
export const getOnboarding = () => apiRequest('/profiles/onboarding')
export const saveOnboarding = progress => apiRequest('/profiles/onboarding', { method: 'PUT', body: JSON.stringify(progress) })
export const OPEN_TUTORIAL_EVENT = 'fokus:open-tutorial'
