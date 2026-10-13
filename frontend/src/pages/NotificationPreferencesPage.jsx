import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePreferenceAutosave } from '../hooks/usePreferenceAutosave.js'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { ErrorState, LoadingState } from '../components/ui/FeedbackState.jsx'
import { NotificationPhrasesEditor } from '../components/common/NotificationPhrasesEditor.jsx'
import { WebPushControls } from '../components/common/WebPushControls.jsx'
import { NotificationTester } from '../components/common/NotificationTester.jsx'
import { NotificationRulesEditor } from '../components/common/NotificationRulesEditor.jsx'
import { getNotificationPhrases, getNotificationPreferences, getNotificationRules } from '../services/notifications.service.js'
import { notificationStyles, preferenceError } from '../utils/notificationPreferences.js'

const NotificationPreferencesPage = () => {
  const [rules, setRules] = useState([])
  const [phrases, setPhrases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reload, setReload] = useState(0)
  const { form, status, initialize, change, retry: retrySave } = usePreferenceAutosave(values => {
    if ([['exam', values.exam_style], ['task', values.task_style]].some(([type, style]) => style === 'custom' && !phrases.some(phrase => phrase.event_type === type))) return 'Agregá una frase propia para cada tipo que use ese estilo.'
    return preferenceError(values)
  }, phrases)
  useEffect(() => {
    let active = true
    Promise.all([getNotificationPreferences(), getNotificationRules(), getNotificationPhrases()]).then(([preferences, savedRules, savedPhrases]) => {
      if (!preferences || !Array.isArray(savedRules) || !Array.isArray(savedPhrases)) throw new Error('La API no devolvió la configuración. Intentá nuevamente.')
      if (active) { initialize(preferences); setRules(savedRules); setPhrases(savedPhrases) }
    }).catch(failure => { if (active) setError(failure.message || 'No pudimos cargar tu configuración.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload, initialize])
  return <>
    <PageHeader eyebrow="Notificaciones" title="Tus recordatorios" description="Elegí cuándo y cómo querés recibir avisos de Fokus."><Link className="btn btn-outline-primary" to="/notifications">Volver a notificaciones</Link></PageHeader>
    {loading ? <LoadingState message="Cargando preferencias y recordatorios…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); setError(null); setReload(value => value + 1) }} /> : <>
      <p className="small text-secondary">Los cambios se guardan automáticamente. El permiso de notificaciones se autoriza en cada dispositivo.</p>
      <form id="notification-preferences-form" onSubmit={event => event.preventDefault()}>
        <fieldset>
          <div className="card border-0 mb-4"><div className="card-body p-4">
            <h2 className="h5 mb-3">Preferencias generales</h2>
            <div className="form-check form-switch mb-3"><input id="notifications-enabled" className="form-check-input" type="checkbox" checked={form.enabled} onChange={event => change('enabled', event.target.checked)} /><label className="form-check-label" htmlFor="notifications-enabled">Activar notificaciones</label></div>
            <label className="form-label" htmlFor="notification-timezone">Zona horaria</label><input id="notification-timezone" className="form-control" type="text" list="notification-timezones" maxLength="100" required value={form.timezone} onChange={event => change('timezone', event.target.value, false)} aria-describedby="timezone-help" onBlur={retrySave} />
            <datalist id="notification-timezones">{['America/Argentina/Cordoba', 'America/Argentina/Buenos_Aires', 'America/Santiago', 'America/Montevideo', 'Europe/Madrid'].map(zone => <option key={zone} value={zone} />)}</datalist>
            <p id="timezone-help" className="small text-secondary mt-2">Las fechas y horas de tus eventos se interpretan en esta zona horaria.</p>
            <div className="form-check mt-3"><input id="unfiltered-consent" className="form-check-input" type="checkbox" checked={form.unfiltered_enabled} onChange={event => change('unfiltered_enabled', event.target.checked)} aria-describedby="unfiltered-help" /><label className="form-check-label" htmlFor="unfiltered-consent">Acepto recibir mensajes sin filtro</label></div>
            <p id="unfiltered-help" className="small text-secondary mt-2 mb-0">Puede usar lenguaje fuerte. Es opcional; al desactivarlo, los estilos sin filtro vuelven a formal.</p>
          </div></div>
          <div className="row g-4 mb-4">{[['exam', 'exams_enabled', 'Exámenes'], ['task', 'tasks_enabled', 'Entregas']].map(([type, field, title]) => <div key={type} className="col-12 col-lg-6"><div className="card border-0 h-100"><div className="card-body p-4">
            <h2 className="h5">{title}</h2>
            <div className="form-check form-switch my-3"><input id={field} type="checkbox" className="form-check-input" checked={form[field]} onChange={event => change(field, event.target.checked)} /><label className="form-check-label" htmlFor={field}>Recibir avisos de {title.toLowerCase()}</label></div>
            <label className="form-label" htmlFor={type + '-default-time'}>Horario predeterminado para {title.toLowerCase()}</label><input id={type + '-default-time'} className="form-control mb-2" type="time" required onBlur={retrySave} value={form[type + '_default_time']} onChange={event => change(type + '_default_time', event.target.value, false)} />
            <p className="small text-secondary">Se utiliza cuando el evento no tiene hora. Una hora específica tiene prioridad.</p>
            <label className="form-label" htmlFor={type + '-style'}>Estilo para {title.toLowerCase()}</label><select id={type + '-style'} className="form-select" value={form[type + '_style']} onChange={event => change(type + '_style', event.target.value)}>{notificationStyles.map(([value, text]) => <option key={value} value={value} disabled={value === 'unfiltered' && !form.unfiltered_enabled}>{text}</option>)}</select>
          </div></div></div>)}</div>
          <div className="card border-0 mb-3"><div className="card-body p-4">
            <h2 className="h5">Horarios de silencio</h2><div className="form-check form-switch my-3"><input id="quiet-enabled" className="form-check-input" type="checkbox" checked={form.quiet_hours_enabled} onChange={event => change('quiet_hours_enabled', event.target.checked)} /><label className="form-check-label" htmlFor="quiet-enabled">Activar horario de silencio</label></div>
            {form.quiet_hours_enabled && <div className="row g-3">{[['quiet_start', 'Inicio del silencio'], ['quiet_end', 'Fin del silencio']].map(([field, label]) => <div key={field} className="col-12 col-sm-6"><label className="form-label" htmlFor={field}>{label}</label><input id={field} className="form-control" type="time" required onBlur={retrySave} value={form[field] ?? ''} onChange={event => change(field, event.target.value, false)} /></div>)}</div>}
            <p className="small text-secondary mt-3 mb-0">Puede cruzar medianoche. Los avisos se aplazarán hasta el final del silencio si no pasó la hora del evento; los de exámenes se detienen al alcanzar esa hora.</p>
          </div></div>
        </fieldset>
        <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
          <span role="status" aria-live="polite" aria-atomic="true" className={'small text-' + (status.kind === 'error' || status.kind === 'invalid' ? 'danger' : 'secondary')}>
            {status.kind === 'saving' ? 'Guardando...' : status.kind === 'saved' ? 'Guardado' : status.kind === 'error' ? 'No se pudo guardar. Tus cambios siguen pendientes; se conserva la última configuración guardada. ' + status.message : status.kind === 'invalid' ? status.message : status.kind === 'pending' ? 'Cambios pendientes...' : ''}
          </span>
          {status.kind === 'error' && <button className="btn btn-sm btn-outline-secondary" type="button" onClick={retrySave}>Reintentar guardado</button>}
        </div>
      </form>
      <div className="row g-4 mt-1">{[['exam', 'exámenes'], ['task', 'entregas']].map(([type, label]) => <div key={type} className="col-12 col-lg-6"><div className="card border-0 h-100"><div className="card-body p-4"><h2 className="h5">Recordatorios de {label}</h2><NotificationRulesEditor type={type} label={label} rules={rules.filter(rule => rule.event_type === type)} onChange={setRules} /><p className="small text-secondary mt-3 mb-0">Para recibirlos, activá las notificaciones generales y la de {label}.</p></div></div></div>)}</div>
      <NotificationPhrasesEditor phrases={phrases} onChange={setPhrases} />
      <WebPushControls remindersEnabled={form.enabled && (form.exams_enabled || form.tasks_enabled)} />
      <NotificationTester phrases={phrases} preferences={form} />
    </>}
  </>
}
export { NotificationPreferencesPage }
