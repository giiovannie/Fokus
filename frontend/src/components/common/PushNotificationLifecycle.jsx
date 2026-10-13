import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { getNotificationPreferences, getPushConfig, getPushSubscriptions } from '../../services/notifications.service.js'
import { activatePush, getPushChoice, setPushChoice, synchronizePush, REMINDER_CREATED_EVENT, PUSH_PREFERENCES_EVENT } from '../../services/pushNotifications.js'

export const PushNotificationLifecycle = () => {
  const { user } = useAuth()
  const [settings, setSettings] = useState(null)
  const [prompt, setPrompt] = useState(false)
  const [attention, setAttention] = useState(false)
  const [busy, setBusy] = useState(false)
  const activating = useRef(false)
  useEffect(() => {
    if (!user || user.role === 'superadmin' || !globalThis.Notification || !navigator.serviceWorker || !globalThis.PushManager || !globalThis.isSecureContext) return
    let active = true, running = false, lastCheck = 0, candidate = null, loadedSettings = null
    const offer = () => {
      if (!candidate || !loadedSettings) return
      const { preferences, config } = loadedSettings
      if (config.enabled && preferences.enabled && preferences[candidate + 's_enabled'] && !getPushChoice(user.id) && Notification.permission !== 'denied') {
        setPushChoice(user.id, 'offered'); setPrompt(true)
      }
      candidate = null
    }
    const refresh = async (force = false) => {
      if (!active || running || activating.current || document.visibilityState === 'hidden' || (!force && Date.now() - lastCheck < 60000)) return
      running = true; lastCheck = Date.now()
      try {
        const [preferences, config] = await Promise.all([getNotificationPreferences(), getPushConfig()])
        if (!active) return
        loadedSettings = { preferences, config }; setSettings(loadedSettings)
        offer()
        if (!config.enabled || !preferences.enabled || (!preferences.exams_enabled && !preferences.tasks_enabled)) {
          setPrompt(false); setAttention(false); return
        }
        const choice = getPushChoice(user.id)
        if (choice !== 'authorized') return
        const devices = await getPushSubscriptions()
        if (!active) return
        const saved = await synchronizePush(config.public_key, devices, { allowRenewal: true })
        if (active) setAttention(!saved && Notification.permission !== 'granted')
      } catch (error) {
        if (active && (error.name === 'NotAllowedError' || error.status === 410)) setAttention(true)
        // Una falla temporal se revisa al recuperar foco/conexión, sin bucles.
      } finally { running = false }
    }
    const resume = () => { void refresh() }
    const preferencesChanged = () => { void refresh(true) }
    const created = event => {
      if (event.detail?.userId === user.id) { candidate = event.detail.type; offer() }
    }
    const timer = setTimeout(() => { void refresh(true) }, 0)
    window.addEventListener('focus', resume)
    window.addEventListener('online', resume)
    document.addEventListener('visibilitychange', resume)
    window.addEventListener(PUSH_PREFERENCES_EVENT, preferencesChanged)
    window.addEventListener(REMINDER_CREATED_EVENT, created)
    return () => {
      active = false; clearTimeout(timer)
      window.removeEventListener('focus', resume); window.removeEventListener('online', resume)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener(PUSH_PREFERENCES_EVENT, preferencesChanged)
      window.removeEventListener(REMINDER_CREATED_EVENT, created)
    }
  }, [user])
  const activate = async () => {
    if (activating.current) return
    activating.current = true; setBusy(true)
    try {
      await activatePush(settings.config.public_key, 'Este dispositivo')
      setAttention(false); setPrompt(false)
    } catch {
      const permitted = Notification.permission === 'granted'
      setPushChoice(user.id, permitted ? 'authorized' : 'dismissed')
      setPrompt(false); setAttention(permitted)
    } finally { activating.current = false; setBusy(false) }
  }
  if (!prompt && !attention) return null
  return <section className="alert alert-info" aria-labelledby="reminder-permission-title">
    <h2 className="h6" id="reminder-permission-title">Tus recordatorios, también fuera de Fokus</h2>
    {prompt ? <>
      <p>Fokus puede recordarte tus exámenes y entregas, incluso cuando no estés usando la aplicación.</p>
      <button className="btn btn-primary me-2" disabled={busy} onClick={activate}>{busy ? 'Activando…' : 'Permitir recordatorios'}</button>
      <button className="btn btn-outline-secondary" disabled={busy} onClick={() => { setPushChoice(user.id, 'dismissed'); setPrompt(false) }}>Ahora no</button>
    </> : <><p>Necesitamos que revises las notificaciones de este dispositivo para recuperar tus avisos. Comprobá la conexión y el permiso del navegador.</p><Link to="/notifications/preferences">Revisar mis notificaciones</Link></>}
  </section>
}
