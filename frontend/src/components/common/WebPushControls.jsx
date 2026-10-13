import { useEffect, useState } from 'react'
import { getPushConfig, getPushSubscriptions } from '../../services/notifications.service.js'
import { activatePush, synchronizePush } from '../../services/pushNotifications.js'

const feedbackMessage = () => globalThis.Notification?.permission === 'denied'
  ? 'Las notificaciones están bloqueadas. Revisá el permiso de este dispositivo.'
  : 'No pudimos actualizar tus avisos. Revisá tu conexión y el permiso de notificaciones, y volvé a intentar.'

export const WebPushControls = ({ remindersEnabled = true }) => {
  const [config, setConfig] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [label, setLabel] = useState('Este navegador')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [reload, setReload] = useState(0)
  const [permission, setPermission] = useState(globalThis.Notification?.permission ?? 'unsupported')
  useEffect(() => {
    let refreshTimer
    const refresh = () => {
      if (busy || document.visibilityState === 'hidden') return
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        const next = globalThis.Notification?.permission ?? 'unsupported'
        setPermission(next)
        if (next !== 'granted') setActiveId(null)
        setReload(value => value + 1)
      }, 100)
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearTimeout(refreshTimer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [busy])
  useEffect(() => {
    let active = true
    const load = async () => {
      const settings = await getPushConfig()
      const saved = settings.enabled ? await getPushSubscriptions() : []
      if (!Array.isArray(saved)) throw new Error('No pudimos cargar tus dispositivos.')
      const own = settings.enabled ? await synchronizePush(settings.public_key, saved, { allowRenewal: remindersEnabled }) : null
      if (active) {
        setConfig(settings)
        setActiveId(own?.id ?? null)
        setPermission(globalThis.Notification?.permission ?? 'unsupported')
        setLabel(own?.device_label || 'Este navegador')
      }
    }
    const timer = setTimeout(() => load().catch(() => { if (active) { setFeedback({ error: true, message: feedbackMessage() }) } }).finally(() => { if (active) setLoading(false) }), 0)
    return () => { active = false; clearTimeout(timer) }
  }, [reload, remindersEnabled])
  const activate = async () => {
    if (busy) return
    setBusy(true); setFeedback(null)
    try {
      const saved = await activatePush(config.public_key, label)
      setActiveId(saved.id)
      setPermission(globalThis.Notification?.permission ?? 'granted')
      setFeedback({ message: 'Notificaciones activadas en este dispositivo.' })
    } catch { setPermission(globalThis.Notification?.permission ?? 'unsupported'); setFeedback({ error: true, message: feedbackMessage() }) }
    finally { setBusy(false) }
  }
  return <section className="card border-0 mt-4" aria-labelledby="push-title"><div className="card-body p-4">
    <h2 className="h5" id="push-title">Notificaciones en este dispositivo</h2>
    <p>Con tu permiso, Fokus mantiene tus avisos en este dispositivo, incluso con la aplicación cerrada.</p>
    {loading ? <p role="status">Revisando tus notificaciones…</p> : config?.enabled ? <>
      <label className="form-label" htmlFor="push-device-name">Nombre de este dispositivo</label><input id="push-device-name" className="form-control mb-3" maxLength="100" value={label} onChange={event => setLabel(event.target.value)} disabled={busy || !!activeId} />
      {activeId ? <p role="status" className="small text-success mb-0">Notificaciones activas en este dispositivo.</p> : permission === 'denied' ? <p className="small text-secondary">Las notificaciones están bloqueadas. En Chrome, abrí la información del sitio → Permisos → Notificaciones → Permitir. En Android, revisá también Ajustes → Aplicaciones → Chrome (o Fokus) → Notificaciones. Después volvé a Fokus.</p> : permission === 'unsupported' ? <p className="small text-secondary">Este navegador no admite notificaciones. La vista previa sigue disponible.</p> : <button className="btn btn-primary" type="button" disabled={busy} onClick={activate}>{busy ? 'Actualizando…' : 'Permitir notificaciones'}</button>}
      <p className="small text-secondary mt-2 mb-0">Podés pausar los avisos en las preferencias generales o revocar el permiso desde el navegador.</p>
    </> : config && <p>Los avisos de este dispositivo todavía no están disponibles. Podés seguir consultando tus recordatorios dentro de Fokus.</p>}
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className={'mt-3 text-' + (feedback.error ? 'danger' : 'success')}>{feedback.message}</p>}
    {feedback?.error && <button type="button" className="btn btn-outline-secondary" onClick={() => { setLoading(true); setFeedback(null); setReload(value => value + 1) }}>Revisar notificaciones</button>}
  </div></section>
}
