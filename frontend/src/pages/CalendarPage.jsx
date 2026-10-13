import { useCallback, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useAppData } from '../hooks/useAppData.js'
import { useCalendar } from '../hooks/useCalendar.js'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { FormModal } from '../components/ui/FormModal.jsx'
import { CALENDAR_CHANGED_EVENT, saveAgendaEvent, deleteAgendaEvent } from '../services/calendar.service.js'
import { REMINDER_CREATED_EVENT } from '../services/pushNotifications.js'
import { addDays, calendarDays, dateLabel, eventTimeLabel, eventTypes, moveMonth, todayIn, validDate } from '../utils/calendar.js'
import './calendar.css'
const emptyForm = date => ({ title: '', description: '', kind: 'personal', event_date: date, event_time: null, subject_id: null, reminder_minutes: null })
export const CalendarPage = () => {
  const [params] = useSearchParams()
  const { user } = useAuth()
  const { data } = useAppData()
  const [selected, setSelected] = useState(() => validDate(params.get('date')) ? params.get('date') : todayIn())
  const [anchor, setAnchor] = useState(selected)
  const [view, setView] = useState('month')
  const interacted = useRef(Boolean(params.get('date')))
  const ready = useCallback(response => {
    if (!interacted.current && response?.timezone) {
      interacted.current = true
      const date = todayIn(response.timezone); setSelected(date); setAnchor(date)
    }
  }, [])
  const days = calendarDays(anchor, view)
  const { events, timezone, loading, error, truncated, reload } = useCalendar(days[0], days.at(-1), false, ready)
  const [detailKey, setDetailKey] = useState(() => params.get('event') ? 'agenda:' + params.get('event') : null)
  const detail = events.find(event => event.key === detailKey)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const saving = useRef(false)
  const setField = (key, value) => setForm(previous => ({ ...previous, [key]: value }))
  const openForm = event => { setEditing(event?.id || null); setFormError(''); setDetailKey(null); setForm(event ? { ...emptyForm(event.date), ...Object.fromEntries(Object.keys(emptyForm(event.date)).map(key => [key, event[key] ?? null])) } : emptyForm(selected)) }
  const changed = () => window.dispatchEvent(new Event(CALENDAR_CHANGED_EVENT))
  const save = async event => {
    event.preventDefault()
    if (saving.current) return
    saving.current = true; setBusy(true); setFormError('')
    try {
      const values = { ...form, title: form.title.trim() }
      if (!values.title || !validDate(values.event_date)) throw new Error('Indicá un título y una fecha válida.')
      await saveAgendaEvent(values, editing)
      changed(); setForm(null); setNotice(editing ? 'Actividad actualizada.' : 'Actividad creada.')
      if (!editing && values.event_time && values.reminder_minutes !== null) window.dispatchEvent(new CustomEvent(REMINDER_CREATED_EVENT, { detail: { userId: user.id, type: 'agenda' } }))
    } catch (failure) { setFormError(failure.message) }
    finally { saving.current = false; setBusy(false) }
  }
  const remove = async event => {
    event.preventDefault()
    if (saving.current) return
    saving.current = true; setBusy(true); setFormError('')
    try { await deleteAgendaEvent(deleting.id); changed(); setDeleting(null); setDetailKey(null); setNotice('Actividad eliminada.') }
    catch (failure) { setFormError(failure.message) }
    finally { saving.current = false; setBusy(false) }
  }
  const navigate = direction => { interacted.current = true; const next = view === 'month' ? moveMonth(anchor, direction) : addDays(anchor, direction * 7); setAnchor(next); setSelected(next); setDetailKey(null) }
  const today = todayIn(timezone)
  const selectedEvents = events.filter(event => event.date === selected)
  return <div className="calendar-page">
    <PageHeader eyebrow="Organización" title="Calendario y agenda" description="Tus exámenes, entregas y actividades en un solo lugar." />
    <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
      <button className="btn btn-outline-secondary" aria-label="Período anterior" onClick={() => navigate(-1)}>‹</button>
      <button className="btn btn-outline-secondary" onClick={() => { interacted.current = true; setAnchor(today); setSelected(today); setDetailKey(null) }}>Hoy</button>
      <button className="btn btn-outline-secondary" aria-label="Período siguiente" onClick={() => navigate(1)}>›</button>
      <select className="form-select calendar-view" aria-label="Vista del calendario" value={view} onChange={event => { interacted.current = true; setView(event.target.value); setAnchor(selected) }}><option value="month">Mes</option><option value="week">Semana</option></select>
      <button className="btn btn-primary ms-auto" onClick={() => openForm()}>Nueva actividad</button>
    </div>
    <h2 className="h5">{view === 'month' ? new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(anchor + 'T12:00:00Z')) : `${dateLabel(days[0])} — ${dateLabel(days.at(-1))}`}</h2>
    <p className="small text-secondary">Horarios en {timezone}. Las actividades sin hora duran todo el día.</p>
    <div className="calendar-legend">{Object.entries(eventTypes).map(([type, label]) => <span key={type}><i className={'calendar-mark ' + type} aria-hidden="true" />{label}</span>)}</div>
    {notice && <p role="status">{notice}</p>}
    {error ? <div role="alert">{error} <button className="btn btn-outline-secondary" onClick={reload}>Reintentar</button></div> : loading ? <p role="status">Cargando calendario…</p> : null}
    {truncated && <p role="alert">Hay demasiadas actividades. Usá la vista semanal para ver un período menor.</p>}
    <div className="calendar-grid" aria-label="Días del calendario">
      {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => <span className="calendar-heading" key={day}>{day}</span>)}
      {days.map(date => {
        const items = events.filter(event => event.date === date)
        return <button key={date} className={'calendar-day' + (date.slice(0, 7) !== anchor.slice(0, 7) && view === 'month' ? ' outside' : '')} aria-label={dateLabel(date) + ', ' + items.length + ' actividades'} aria-pressed={selected === date} aria-current={date === today ? 'date' : undefined} onClick={() => { interacted.current = true; setSelected(date); setDetailKey(null) }}>
          <span>{Number(date.slice(-2))}</span><span className="calendar-dots">{Object.entries(eventTypes).map(([type, label]) => { const count = items.filter(item => item.type === type).length; return count > 0 && <span key={type} className={'calendar-count ' + type} title={`${count} ${label}`} aria-label={`${count} ${label}`}><i className={'calendar-mark ' + type} aria-hidden="true" />{count}</span> })}</span>
        </button>
      })}
    </div>
    <section className="card border-0 mt-4"><div className="card-body"><h2 className="h5">{dateLabel(selected)}</h2>
      {!loading && !error && !selectedEvents.length && <p className="text-secondary">No hay actividades para este día.</p>}
      {selectedEvents.map(event => <button className="calendar-activity" key={event.key} onClick={() => setDetailKey(event.key)}><i className={'calendar-mark ' + event.type} aria-hidden="true" /><strong>{event.title}</strong><span>{eventTypes[event.type]} · {eventTimeLabel(event)}{event.subject ? ' · ' + event.subject : ''}{event.status === 'completed' ? ' · Completada' : ''}</span></button>)}
    </div></section>
    <FormModal open={Boolean(detail)} title={detail?.title || 'Actividad'} onClose={() => setDetailKey(null)}>
      {detail && <><p>{eventTypes[detail.type]} · {dateLabel(detail.date)} · {eventTimeLabel(detail)}</p>{detail.subject && <p>Materia: {detail.subject}</p>}{detail.description && <p className="calendar-description">{detail.description}</p>}{detail.href ? <Link className="btn btn-primary" to={detail.href}>Abrir {eventTypes[detail.type].toLowerCase()}</Link> : <><p>Recordatorio: {detail.reminder_minutes === null ? 'Desactivado' : detail.reminder_minutes === 0 ? 'Al comenzar' : `${detail.reminder_minutes} minutos antes`}</p><button className="btn btn-primary me-2" onClick={() => openForm(detail)}>Editar actividad</button><button className="btn btn-outline-danger" onClick={() => { setDeleting(detail); setDetailKey(null); setFormError('') }}>Eliminar actividad</button></>}</>}
    </FormModal>
    <FormModal open={Boolean(form)} title={editing ? 'Editar actividad' : 'Nueva actividad'} onClose={() => setForm(null)} busy={busy} error={formError} formId="agenda-form" submitLabel="Guardar actividad">
      {form && <form id="agenda-form" onSubmit={save} className="d-grid gap-3">
        <label>Título<input className="form-control" required maxLength={180} value={form.title} onChange={event => setField('title', event.target.value)} /></label>
        <label>Descripción<textarea className="form-control" maxLength={5000} value={form.description || ''} onChange={event => setField('description', event.target.value)} /></label>
        <label>Tipo<select className="form-select" value={form.kind} onChange={event => setForm(previous => ({ ...previous, kind: event.target.value, subject_id: null }))}><option value="personal">Personal</option><option value="academic">Académico</option></select></label>
        <label>Fecha<input className="form-control" required type="date" value={form.event_date} onChange={event => setField('event_date', event.target.value)} /></label>
        <label><input type="checkbox" checked={form.event_time === null} onChange={event => setForm(previous => ({ ...previous, event_time: event.target.checked ? null : '09:00', reminder_minutes: null }))} /> Todo el día</label>
        {form.event_time !== null && <label>Hora<input className="form-control" required type="time" value={form.event_time} onChange={event => setField('event_time', event.target.value)} /></label>}
        {form.kind === 'academic' && <label>Materia (opcional)<select className="form-select" value={form.subject_id || ''} onChange={event => setField('subject_id', event.target.value ? Number(event.target.value) : null)}><option value="">Sin materia</option>{data.subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>}
        <label>Recordatorio<select className="form-select" disabled={!form.event_time} value={form.reminder_minutes ?? ''} onChange={event => setField('reminder_minutes', event.target.value === '' ? null : Number(event.target.value))}><option value="">Desactivado</option><option value="0">Al comenzar</option><option value="15">15 minutos antes</option><option value="60">1 hora antes</option><option value="1440">1 día antes</option></select></label>
        <p className="small text-secondary">Los avisos respetan tus preferencias de notificaciones y horarios de silencio. No se envían avisos retroactivos. Para recibir un aviso indicá una hora.</p>
      </form>}
    </FormModal>
    <FormModal open={Boolean(deleting)} title="Eliminar actividad" onClose={() => setDeleting(null)} busy={busy} error={formError} formId="agenda-delete" submitLabel="Eliminar" danger><form id="agenda-delete" onSubmit={remove}><p>¿Eliminar «{deleting?.title}» y cancelar sus recordatorios pendientes?</p></form></FormModal>
  </div>
}
