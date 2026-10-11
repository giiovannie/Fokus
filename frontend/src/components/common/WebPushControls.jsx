import { useEffect, useState } from 'react'
import { getPushConfig, getPushSubscriptions } from '../../services/notifications.service.js'
import { activatePush, deactivatePush, getPushDeviceId } from '../../services/pushNotifications.js'

export const WebPushControls = () => {
  const [config, setConfig] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [label, setLabel] = useState('Este navegador')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    const load = async () => {
      const settings = await getPushConfig()
      const saved = settings.enabled ? await getPushSubscriptions() : []
      if (!Array.isArray(saved)) throw new Error('No pudimos cargar tus dispositivos.')
      const own = saved.find(device => device.device_id === getPushDeviceId())
      const registration = await navigator.serviceWorker?.getRegistration?.()
      const local = await registration?.pushManager?.getSubscription()
      if (active) {
        setConfig(settings)
        setActiveId(own && local && globalThis.Notification?.permission === 'granted' ? own.id : null)
        setLabel(own?.device_label || 'Este navegador')
      }
    }
    load().catch(error => { if (active) { setFeedback({ error: true, message: error.message }) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])
  const activate = async () => {
    if (busy) return
    setBusy(true); setFeedback(null)
    try {
      const saved = await activatePush(config.public_key, label)
      setActiveId(saved.id)
      setFeedback({ message: 'Notificaciones Push activadas en este navegador.' })
    } catch (error) { setFeedback({ error: true, message: error.message || 'No pudimos activar las notificaciones. Volvé a intentar.' }) }
    finally { setBusy(false) }
  }
  const deactivate = async () => {
    if (busy) return
    setBusy(true); setFeedback(null)
    try {
      await deactivatePush(activeId)
      setActiveId(null)
      setFeedback({ message: 'Notificaciones Push desactivadas en este navegador.' })
    } catch (error) { setFeedback({ error: true, message: error.message }) }
    finally { setBusy(false) }
  }
  return <section className="card border-0 mt-4" aria-labelledby="push-title"><div className="card-body p-4">
    <h2 className="h5" id="push-title">Notificaciones en este dispositivo</h2>
    <p>La activación es voluntaria y se realiza en cada navegador. Activá este dispositivo para recibir tus recordatorios incluso con Fokus cerrada.</p>
    {loading ? <p role="status">Cargando notificaciones Push…</p> : config?.enabled ? <>
      <label className="form-label" htmlFor="push-device-name">Nombre de este dispositivo</label><input id="push-device-name" className="form-control mb-3" maxLength="100" value={label} onChange={event => setLabel(event.target.value)} disabled={busy || !!activeId} />
      <button className={'btn btn-' + (activeId ? 'outline-danger' : 'primary')} type="button" disabled={busy} onClick={activeId ? deactivate : activate}>{busy ? 'Actualizando…' : activeId ? 'Desactivar notificaciones Push' : 'Activar notificaciones Push'}</button>
    </> : config && <p>El servidor todavía no tiene configuradas las notificaciones Push. La vista previa y la prueba local siguen disponibles.</p>}
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className={'mt-3 text-' + (feedback.error ? 'danger' : 'success')}>{feedback.message}</p>}
    {feedback?.error && !config && <button type="button" className="btn btn-outline-secondary" onClick={() => { setLoading(true); setFeedback(null); setReload(value => value + 1) }}>Reintentar notificaciones Push</button>}
  </div></section>
}
