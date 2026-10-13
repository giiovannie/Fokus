import { useCallback, useEffect, useRef, useState } from 'react'
import { saveNotificationPreferences } from '../services/notifications.service.js'
import { preferencesPayload } from '../utils/notificationPreferences.js'
import { PUSH_PREFERENCES_EVENT } from '../services/pushNotifications.js'

export const usePreferenceAutosave = (validate, validationInputs) => {
  const [form, setForm] = useState(null)
  const [status, setStatus] = useState({ kind: 'idle' })
  const state = useRef({ draft: null, confirmed: null, revision: 0, busy: false, due: false, timer: null, active: true })
  const validation = useRef(validate)
  useEffect(() => { validation.current = validate }, [validate])
  useEffect(() => {
    const s = state.current
    s.active = true
    return () => { s.active = false; clearTimeout(s.timer) }
  }, [])
  const pump = useCallback(async function processPending() {
    const s = state.current
    if (!s.active || s.busy || !s.due || !s.draft) return
    s.due = false
    const problem = validation.current(s.draft)
    if (problem) { setStatus({ kind: 'invalid', message: problem }); return }
    const snapshot = preferencesPayload(s.draft), revision = s.revision
    if (JSON.stringify(snapshot) === JSON.stringify(s.confirmed)) { setStatus({ kind: 'saved' }); return }
    s.busy = true
    setStatus({ kind: 'saving' })
    try {
      const saved = preferencesPayload(await saveNotificationPreferences(snapshot))
      window.dispatchEvent(new Event(PUSH_PREFERENCES_EVENT))
      s.confirmed = saved
      if (!s.active) return
      if (revision === s.revision) { s.draft = saved; setForm(saved); setStatus({ kind: 'saved' }) }
    } catch (error) {
      // No reintentar silenciosamente ni afirmar que el borrador fue persistido.
      s.due = false
      clearTimeout(s.timer)
      if (s.active) setStatus({ kind: 'error', message: error.message || 'Revisá tu conexión.' })
    } finally {
      s.busy = false
      if (s.active && s.due) processPending()
    }
  }, [])
  useEffect(() => {
    const s = state.current
    if (s.draft && JSON.stringify(preferencesPayload(s.draft)) !== JSON.stringify(s.confirmed) && !validation.current(s.draft)) {
      s.due = true; pump()
    }
  }, [validationInputs, pump])
  const initialize = useCallback(values => {
    const payload = preferencesPayload(values)
    Object.assign(state.current, { draft: payload, confirmed: payload, due: false })
    setForm(payload); setStatus({ kind: 'idle' })
  }, [])
  const change = useCallback((key, value, immediate = true) => {
    const s = state.current
    clearTimeout(s.timer)
    const next = { ...s.draft, [key]: value }
    if (key === 'unfiltered_enabled' && !value) {
      for (const field of ['exam_style', 'task_style']) if (next[field] === 'unfiltered') next[field] = 'formal'
    }
    s.draft = next; s.revision += 1; s.due = false
    setForm(next)
    const problem = validation.current(next)
    if (problem) { setStatus({ kind: 'invalid', message: problem }); return }
    setStatus({ kind: s.busy ? 'saving' : 'pending' })
    if (immediate) { s.due = true; pump() }
    else s.timer = setTimeout(() => { s.due = true; pump() }, 450)
  }, [pump])
  const retry = useCallback(() => {
    clearTimeout(state.current.timer)
    state.current.due = true
    pump()
  }, [pump])
  return { form, status, initialize, change, retry }
}
