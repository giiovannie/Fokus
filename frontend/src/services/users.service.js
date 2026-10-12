import { apiRequest } from './api.js'

export const createUser = (user) => apiRequest('/users', { method: 'POST', body: JSON.stringify(user) })
export const getUser = (id) => apiRequest(`/users/${id}`)

export const deleteMyAccount = values => apiRequest('/users/me', { method: 'DELETE', body: JSON.stringify(values) })
