import { apiRequest } from './api.js'
export const CALENDAR_CHANGED_EVENT = 'fokus:calendar-changed'
export const getCalendar = (from, to, customOnly = false, signal) => apiRequest(`/calendar?from=${from}&to=${to}${customOnly ? '&custom_only=true' : ''}`, { signal })
export const saveAgendaEvent = (values, id) => apiRequest('/calendar/events' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', body: JSON.stringify(values) })
export const deleteAgendaEvent = id => apiRequest('/calendar/events/' + id, { method: 'DELETE' })
