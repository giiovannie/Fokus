import { useState } from 'react'
import { createNotificationRule, deleteNotificationRule, updateNotificationRule } from '../../services/notifications.service.js'
import { reminderError, reminderLabel, reminderUnits, ruleDraft } from '../../utils/notificationPreferences.js'

const presets = [10080, 4320, 1440, 180, 60]
const initialDraft = () => ({ amount: '1', unit: 'days', enabled: true })
const NotificationRulesEditor = ({ type, label, rules, onChange, disabled }) => {
  const [draft, setDraft] = useState(initialDraft)
  const [editingId, setEditingId] = useState(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const selected = rules.filter(rule => rule.enabled).length
  const customRules = rules.filter(rule => !presets.includes(rule.offset_minutes))
  const reset = () => { setDraft(initialDraft()); setEditingId(null); setCustomOpen(false) }
  const persist = async (operation, message) => {
    if (busy) return
    setBusy(true); setFeedback(null)
    try { await operation(); setFeedback({ message }) }
    catch (error) { setFeedback({ error: true, message: error.status === 409 ? 'No se pudo seleccionar ese horario. Revisá que no esté repetido y que tengas menos de 5 recordatorios guardados.' : error.message || 'No pudimos guardar el cambio. Intentá nuevamente.' }) }
    finally { setBusy(false) }
  }
  const remove = async rule => {
    await deleteNotificationRule(rule.id)
    onChange(current => current.filter(item => item.id !== rule.id))
    if (editingId === rule.id) reset()
  }
  const toggle = (minutes, rule) => {
    if (busy || disabled) return
    if (!rule && rules.length >= 5) { setFeedback({ error: true, message: 'Ya tenés 5 recordatorios. Quitá uno para elegir otro.' }); return }
    persist(async () => {
      if (rule?.enabled) { await remove(rule); return }
      const values = { event_type: type, amount: minutes, unit: 'minutes', enabled: true }
      const saved = rule ? await updateNotificationRule(rule.id, values) : await createNotificationRule(values)
      onChange(current => rule ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved])
    }, rule?.enabled ? 'Recordatorio deseleccionado.' : 'Recordatorio seleccionado.')
  }
  const saveCustom = event => {
    event.preventDefault()
    const error = reminderError(draft, rules, editingId)
    if (error) { setFeedback({ error: true, message: error }); return }
    persist(async () => {
      const values = { ...draft, amount: Number(draft.amount), event_type: type }
      const saved = editingId === null ? await createNotificationRule(values) : await updateNotificationRule(editingId, values)
      onChange(current => editingId === null ? [...current, saved] : current.map(rule => rule.id === saved.id ? saved : rule))
      reset()
    }, 'Horario personalizado guardado.')
  }
  const option = (minutes, rule) => <button type="button" role="checkbox" aria-checked={Boolean(rule?.enabled)} aria-describedby={type + '-selection-count'} disabled={disabled || busy || (!rule && rules.length >= 5)} className={'list-group-item list-group-item-action d-flex align-items-center justify-content-between gap-3 py-3 ' + (rule?.enabled ? 'border-primary text-primary bg-primary-subtle' : '')} onClick={() => toggle(minutes, rule)}>
    <span>{reminderLabel(minutes)}</span><span aria-hidden="true" className={'rounded border px-2 ' + (rule?.enabled ? 'bg-primary text-white border-primary' : 'text-secondary')}>{rule?.enabled ? '✓' : '○'}</span>
  </button>
  return <section aria-label={'Recordatorios de ' + label} className="mt-4">
    <h3 className="h6">¿Cuándo querés que te avisemos?</h3>
    <p className="small text-secondary">Elegí hasta 5 momentos para recibir recordatorios antes de tus exámenes o entregas. Podés seleccionar varias opciones.</p>
    <p id={type + '-selection-count'} className="small fw-semibold" aria-live="polite">{selected} de 5 recordatorios seleccionados</p>
    <fieldset disabled={disabled || busy}>
      <div className="list-group mb-3">{presets.map(minutes => <div key={minutes}>{option(minutes, rules.find(rule => rule.offset_minutes === minutes))}</div>)}</div>
      {customRules.length > 0 && <div className="mb-3"><h4 className="h6">Tus horarios personalizados</h4>{customRules.map(rule => <div key={rule.id} className="mb-2">
        <div className="list-group">{option(rule.offset_minutes, rule)}</div>
        <button className="btn btn-sm btn-outline-secondary mt-2" type="button" aria-label={'Editar ' + reminderLabel(rule.offset_minutes) + ' de ' + label} onClick={() => { setEditingId(rule.id); setDraft(ruleDraft(rule)); setCustomOpen(true); setFeedback(null) }}>Editar horario</button>
      </div>)}</div>}
      {rules.some(rule => !rule.enabled) && <div className="small mb-3"><p className="text-secondary">Conservamos tus horarios desactivados. También ocupan un lugar; podés seleccionarlos o quitarlos para elegir otros.</p>{rules.filter(rule => !rule.enabled).map(rule => <button className="btn btn-sm btn-outline-secondary me-2 mb-2" key={rule.id} type="button" onClick={() => persist(() => remove(rule), 'Horario quitado.')} aria-label={'Quitar horario desactivado ' + reminderLabel(rule.offset_minutes) + ' de ' + label}>Quitar {reminderLabel(rule.offset_minutes)}</button>)}</div>}
      <button className="btn btn-outline-primary" type="button" disabled={rules.length >= 5 && editingId === null} aria-expanded={customOpen} aria-controls={type + '-custom-form'} onClick={() => { reset(); setCustomOpen(true); setFeedback(null) }}>Agregar un horario personalizado</button>
      {rules.length >= 5 && <p className="small text-secondary mt-2">Ya tenés 5 horarios guardados. Deseleccioná uno o quitá un horario desactivado para agregar otro.</p>}
      {customOpen && <form id={type + '-custom-form'} className="mt-3" onSubmit={saveCustom}>
        <h4 className="h6">{editingId === null ? 'Nuevo horario personalizado' : 'Editar horario personalizado'}</h4>
        <div className="row g-2 mb-3"><div className="col-6"><label className="form-label" htmlFor={type + '-amount'}>Cantidad para {label}</label><input id={type + '-amount'} className="form-control" type="number" min="0" max={43200 / reminderUnits[draft.unit]} step="1" required value={draft.amount} onChange={event => setDraft({ ...draft, amount: event.target.value })} /></div><div className="col-6"><label className="form-label" htmlFor={type + '-unit'}>Unidad para {label}</label><select id={type + '-unit'} className="form-select" value={draft.unit} onChange={event => setDraft({ ...draft, unit: event.target.value })}><option value="minutes">Minutos</option><option value="hours">Horas</option><option value="days">Días</option></select></div></div>
        <p className="small text-secondary">Hasta 30 días antes. Un día equivale a 24 horas.</p>
        <button className="btn btn-primary" type="submit">Guardar horario personalizado de {label}</button><button className="btn btn-outline-secondary ms-2" type="button" onClick={reset}>Cancelar</button>
      </form>}
      {type === 'exam' && rules.some(rule => rule.offset_minutes === 0) && <p className="small text-secondary mt-3">Los avisos de exámenes se detienen a su hora efectiva; un recordatorio sin anticipación no se enviará.</p>}
    </fieldset>
    {busy && <p role="status" className="small mt-2">Guardando selección…</p>}
    {feedback && <p className={'small mt-3 text-' + (feedback.error ? 'danger' : 'success')} role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
  </section>
}
export { NotificationRulesEditor }
