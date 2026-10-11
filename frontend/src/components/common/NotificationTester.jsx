import { useEffect, useRef, useState } from 'react'
import { notificationStyles } from '../../utils/notificationPreferences.js'
import { getNotificationPreview, sendPushTest } from '../../services/notifications.service.js'
import { sendLocalNotification } from '../../services/localNotifications.js'
export const NotificationTester = ({ phrases, preferences, pushSubscriptionId, onPushExpired }) => {
  const [type, setType] = useState('exam')
  const [style, setStyle] = useState('formal')
  const [consent, setConsent] = useState(false)
  const [variation, setVariation] = useState(0)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [previewState, setPreviewState] = useState({})
  const previousPhrase = useRef()
  const requestKey = JSON.stringify({ type, style, consent, variation, phrases, preferences })
  const previewProblem = style === 'unfiltered' && !consent ? 'Aceptá explícitamente los mensajes sin filtro antes de probarlos.'
    : style === 'custom' && !phrases.some(phrase => phrase.event_type === type) ? 'Agregá al menos una frase propia para este tipo de evento.' : null
  const preview = previewProblem ? { error: previewProblem } : previewState.key === requestKey ? previewState : { loading: true }
  useEffect(() => {
    if (previewProblem) return
    let active = true
    getNotificationPreview({ event_type: type, style, unfiltered_consent: consent,
      ...(previousPhrase.current ? { previous_phrase: previousPhrase.current } : {}) }).then(message => {
      if (!message || typeof message.title !== 'string' || typeof message.body !== 'string') throw new Error('No pudimos cargar la vista previa.')
      if (active) { previousPhrase.current = message.phrase; setPreviewState({ key: requestKey, message }) }
    }).catch(error => { if (active) setPreviewState({ key: requestKey, error: error.message || 'No pudimos cargar la vista previa. Volvé a probar.' }) })
    return () => { active = false }
  }, [requestKey, previewProblem, type, style, consent])
  const send = async () => {
    if (busy || !preview.message) return
    setBusy(true); setFeedback(null)
    try {
      await sendLocalNotification(preview.message)
      setFeedback({ key: requestKey, message: 'Prueba enviada al dispositivo. Si no ves el aviso, revisá No molestar y los permisos de notificaciones de Windows.' })
    } catch (error) { setFeedback({ key: requestKey, error: true, message: error.message }) }
    finally { setBusy(false) }
  }
  const sendRemote = async () => {
    if (busy || !preview.message || !pushSubscriptionId) return
    setBusy(true); setFeedback(null)
    try {
      const result = await sendPushTest(pushSubscriptionId, { event_type: type, style, unfiltered_consent: consent, selected_phrase: preview.message.phrase })
      setFeedback({ key: requestKey, message: result.message })
    } catch (error) {
      setFeedback({ key: requestKey, error: true, message: error.message })
      if (error.status === 410 || error.status === 404) onPushExpired?.()
    } finally { setBusy(false) }
  }
  return <section className="card border-0 mt-4" aria-labelledby="test-notification-title"><div className="card-body p-4">
    <h2 id="test-notification-title" className="h5">Probar notificación</h2>
    <p>Usamos un evento de ejemplo. La prueba no cambia tus preferencias ni crea recordatorios. El ejemplo usa tus horarios y zona horaria guardados.</p>
    <div className="row g-3"><div className="col-12 col-sm-6"><label className="form-label" htmlFor="test-event">Evento de prueba</label><select id="test-event" className="form-select" disabled={busy} value={type} onChange={event => { setType(event.target.value); setFeedback(null) }}><option value="exam">Examen</option><option value="task">Entrega</option></select></div>
      <div className="col-12 col-sm-6"><label className="form-label" htmlFor="test-style">Personalidad de prueba</label><select id="test-style" className="form-select" disabled={busy} value={style} onChange={event => { setStyle(event.target.value); setFeedback(null) }}>{notificationStyles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
    {style === 'unfiltered' && <div className="form-check mt-3"><input id="test-unfiltered" type="checkbox" className="form-check-input" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} /><label htmlFor="test-unfiltered" className="form-check-label">Acepto lenguaje fuerte para esta prueba</label></div>}
    <div className="border rounded p-3 my-3" aria-label="Vista previa de notificación" aria-live="polite">{preview.loading ? <p role="status" className="mb-0">Preparando vista previa…</p> : preview.error ? <p className="mb-0">{preview.error}</p> : <><div className="d-flex align-items-center gap-2 mb-2"><img src="/icons/fokus-192.png" alt="" width="32" height="32" /><strong>{preview.message.title}</strong></div><p className="mb-0" style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{preview.message.body}</p></>}</div>
    <div className="d-flex flex-wrap gap-2"><button className="btn btn-primary" type="button" onClick={send} disabled={busy || !preview.message}>{busy ? 'Enviando prueba…' : 'Enviar notificación de prueba'}</button><button className="btn btn-outline-primary" type="button" onClick={sendRemote} disabled={busy || !preview.message || !pushSubscriptionId}>Enviar prueba desde Express</button><button className="btn btn-outline-secondary" type="button" disabled={busy || preview.loading} onClick={() => setVariation(value => value + 1)}>{preview.error ? 'Reintentar vista previa' : 'Ver otra frase'}</button></div>
    {feedback?.key === requestKey && <p role={feedback.error ? 'alert' : 'status'} className={'mt-3 text-' + (feedback.error ? 'danger' : 'success')}>{feedback.message}</p>}
    <p className="small text-secondary mt-3 mb-0">La prueba local usa este navegador con Fokus abierta. La prueba desde Express necesita un dispositivo Push activado y puede llegar con Fokus cerrada. Ninguna prueba genera recordatorios automáticos.</p>
  </div></section>
}
