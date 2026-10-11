import { useEffect, useState } from 'react'
import { getPushConfig, getPushSubscriptions } from '../../services/notifications.service.js'
import { activatePush, deactivatePush, getPushDeviceId } from '../../services/pushNotifications.js'

export const WebPushControls = ({ onChange, revision = 0 }) => {
  const [config, setConfig] = useState(null)
  const [devices, setDevices] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [selected, setSelected] = useState('')
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
        setConfig(settings); setDevices(saved)
        setActiveId(own && local && globalThis.Notification?.permission === 'granted' ? own.id : null)
        setLabel(own?.device_label || 'Este navegador')
        const target = own?.id || saved[0]?.id || ''
        setSelected(String(target)); onChange(target || null)
      }
    }
    load().catch(error => { if (active) { setFeedback({ error: true, message: error.message }); onChange(null) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload, revision, onChange])
  const activate = async () => {
    if (busy) return
    setBusy(true); setFeedback(null)
    try {
      const saved = await activatePush(config.public_key, label)
      setDevices(current => [...current.filter(device => device.id !== saved.id), saved]); setActiveId(saved.id)
      setSelected(String(saved.id)); onChange(saved.id)
      setFeedback({ message: 'Notificaciones Push activadas en este navegador. Ya podés probar el envío desde Express.' })
    } catch (error) { setFeedback({ error: true, message: error.message || 'No pudimos activar las notificaciones. Volvé a intentar.' }) }
    finally { setBusy(false) }
  }
  const deactivate = async () => {
    if (busy) return
    setBusy(true); setFeedback(null)
    try {
      await deactivatePush(activeId)
      const remaining = devices.filter(device => device.id !== activeId)
      setDevices(remaining); setActiveId(null)
      const target = remaining[0]?.id || ''
      setSelected(String(target)); onChange(target || null)
      setFeedback({ message: 'Notificaciones Push desactivadas en este navegador.' })
    } catch (error) { setFeedback({ error: true, message: error.message }) }
    finally { setBusy(false) }
  }
  return <section className="card border-0 mt-4" aria-labelledby="push-title"><div className="card-body p-4">
    <h2 className="h5" id="push-title">Notificaciones en este dispositivo</h2>
    <p>La activación es voluntaria y se realiza en cada navegador. La prueba desde Express puede llegar con Fokus cerrada. Los recordatorios automáticos todavía no están habilitados.</p>
    {loading ? <p role="status">Cargando notificaciones Push…</p> : config?.enabled ? <>
      <label className="form-label" htmlFor="push-device-name">Nombre de este dispositivo</label><input id="push-device-name" className="form-control mb-3" maxLength="100" value={label} onChange={event => setLabel(event.target.value)} disabled={busy || !!activeId} />
      <button className={'btn btn-' + (activeId ? 'outline-danger' : 'primary')} type="button" disabled={busy} onClick={activeId ? deactivate : activate}>{busy ? 'Actualizando…' : activeId ? 'Desactivar notificaciones Push' : 'Activar notificaciones Push'}</button>
      {devices.length > 0 && <div className="mt-3"><label htmlFor="push-test-device" className="form-label">Dispositivo para la prueba desde Express</label><select id="push-test-device" className="form-select" value={selected} disabled={busy} onChange={event => { setSelected(event.target.value); onChange(Number(event.target.value)) }}>{devices.map(device => <option key={device.id} value={device.id}>{device.device_label} (#{device.id})</option>)}</select><p className="small text-secondary mt-2">Podés elegir otro dispositivo propio y cerrar Fokus allí antes de enviar la prueba.</p></div>}
    </> : config && <p>El servidor todavía no tiene configuradas las notificaciones Push. La vista previa y la prueba local siguen disponibles.</p>}
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className={'mt-3 text-' + (feedback.error ? 'danger' : 'success')}>{feedback.message}</p>}
    {feedback?.error && !config && <button type="button" className="btn btn-outline-secondary" onClick={() => { setLoading(true); setFeedback(null); setReload(value => value + 1) }}>Reintentar notificaciones Push</button>}
  </div></section>
}
