import { apiRequest } from './api.js'

const normalizeProfile = (profile) => (
  typeof profile.avatar_url === 'string' && profile.avatar_url.trim() === ''
    ? { ...profile, avatar_url: null }
    : profile
)

export const getProfile = (userId) => apiRequest(`/profiles/${userId}`)
export const createProfile = (profile) => apiRequest('/profiles', { method: 'POST', body: JSON.stringify(normalizeProfile(profile)) })
export const updateProfile = (id, profile) => apiRequest(`/profiles/${id}`, { method: 'PUT', body: JSON.stringify(normalizeProfile(profile)) })
