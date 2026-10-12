import { apiRequest } from './api.js'
export const getAdminStatistics = () => apiRequest('/admin/statistics')
