import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth.js'
import { getCalendar, CALENDAR_CHANGED_EVENT } from '../services/calendar.service.js'
import { DEFAULT_ZONE } from '../utils/calendar.js'
export const useCalendar = (from, to, customOnly = false, onReady) => {
  const { user } = useAuth()
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState(null)
  const reload = useCallback(() => setVersion(value => value + 1), [])
  const key = `${user?.id}:${from}:${to}:${customOnly}`
  useEffect(() => {
    if (!user || user.role === 'superadmin') return
    const controller = new AbortController()
    let active = true
    getCalendar(from, to, customOnly, controller.signal).then(data => {
      if (active) { setResult({ key, ...data }); onReady?.(data) }
    }).catch(error => { if (active && error.name !== 'AbortError') setResult({ key, events: [], error: error.message }) })
    window.addEventListener(CALENDAR_CHANGED_EVENT, reload)
    return () => { active = false; controller.abort(); window.removeEventListener(CALENDAR_CHANGED_EVENT, reload) }
  }, [user, from, to, customOnly, key, version, reload, onReady])
  const visible = result?.key === key ? result : null
  return { events: visible?.events || [], timezone: (result?.key.startsWith(user?.id + ':') ? result.timezone : null) || DEFAULT_ZONE, truncated: visible?.truncated, error: visible?.error, loading: !visible, reload }
}
