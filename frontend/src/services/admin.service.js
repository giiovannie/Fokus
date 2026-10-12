import { apiRequest } from './api.js'
export const getAdminStatistics = () => apiRequest('/admin/statistics')
const query = filters => new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '')).toString()
export const getAdminUsers = filters => apiRequest('/admin/users?' + query(filters))
export const getAdminUser = id => apiRequest('/admin/users/' + id)
export const updateAdminUserStatus = (id, values) => apiRequest('/admin/users/' + id + '/status', { method: 'PATCH', body: JSON.stringify(values) })
export const deleteAdminUser = (id, values) => apiRequest('/admin/users/' + id, { method: 'DELETE', body: JSON.stringify(values) })
export const getAdminSubjects = filters => apiRequest('/admin/subjects?' + query(filters))
export const getAdminSystem = () => apiRequest('/admin/system')
