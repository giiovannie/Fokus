import { useState } from 'react'
import { createNotificationPhrase, updateNotificationPhrase, deleteNotificationPhrase } from '../../services/notifications.service.js'
export const NotificationPhrasesEditor = ({ phrases, onChange, disabled }) => {
  const [draft, setDraft] = useState({ event_type: 'exam', content: '' })
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const reset = () => { setEditing(null); setDraft({ event_type: 'exam', content: '' }) }
  const save = async event => {
    event.preventDefault()
    const content = draft.content.trim()
    // eslint-disable-next-line no-control-regex -- reject invisible controls in user phrases
    if (!content || Array.from(content).length > 240 || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(content)) { setFeedback({ error: true, message: 'Escribí entre 1 y 240 caracteres, sin saltos de línea ni caracteres de control.' }); return }
    if (phrases.some(item => item.id !== editing && item.event_type === draft.event_type && item.content === content)) { setFeedback({ error: true, message: 'Ya tenés esa frase para ese tipo de evento.' }); return }
    setBusy(true); setFeedback(null)
    try {
      const values = { ...draft, content }
      const saved = editing ? await updateNotificationPhrase(editing, values) : await createNotificationPhrase(values)
      onChange(current => editing ? current.map(item => item.id === editing ? saved : item) : [...current, saved])
      reset(); setFeedback({ message: 'Frase guardada.' })
    } catch (error) { setFeedback({ error: true, message: error.message || 'No pudimos guardar tu frase.' }) }
    finally { setBusy(false) }
  }
  const remove = async id => {
    setBusy(true); setFeedback(null)
    try {
      await deleteNotificationPhrase(id)
      onChange(current => current.filter(item => item.id !== id))
      if (editing === id) reset()
      setFeedback({ message: 'Frase eliminada.' })
    } catch (error) { setFeedback({ error: true, message: error.message || 'No pudimos eliminar tu frase.' }) }
    finally { setBusy(false) }
  }
  return <section className="card border-0 mt-4" aria-labelledby="phrases-title"><div className="card-body p-4">
    <h2 id="phrases-title" className="h5">Mis propias frases</h2>
    <p>Escribí mensajes con tu voz. Fokus siempre agrega la materia, la fecha y el horario del evento.</p>
    <p aria-live="polite">{phrases.length} de 10 frases guardadas entre exámenes y entregas</p>
    <ul className="list-group mb-3">{phrases.map(item => <li key={item.id} className="list-group-item d-flex flex-wrap align-items-center gap-2"><span className="flex-grow-1" style={{ overflowWrap: 'anywhere' }}><strong>{item.event_type === 'exam' ? 'Examen' : 'Entrega'}:</strong> {item.content}</span><button type="button" className="btn btn-sm btn-outline-primary" disabled={disabled || busy} aria-label={'Editar frase: ' + item.content} onClick={() => { setEditing(item.id); setDraft({ event_type: item.event_type, content: item.content }); setFeedback(null) }}>Editar</button><button type="button" className="btn btn-sm btn-outline-danger" disabled={disabled || busy} aria-label={'Eliminar frase: ' + item.content} onClick={() => remove(item.id)}>Eliminar</button></li>)}</ul>
    <form onSubmit={save}><fieldset disabled={disabled || busy}>
      <label htmlFor="phrase-event" className="form-label">Frase para</label><select id="phrase-event" className="form-select mb-3" value={draft.event_type} onChange={event => setDraft({ ...draft, event_type: event.target.value })}><option value="exam">Exámenes</option><option value="task">Entregas</option></select>
      <label htmlFor="phrase-content" className="form-label">Tu frase</label><input id="phrase-content" className="form-control" maxLength={240} required value={draft.content} onChange={event => setDraft({ ...draft, content: event.target.value })} aria-describedby="phrase-help" />
      <p id="phrase-help" className="small text-secondary mt-2">Hasta 240 caracteres. Podés guardar 10 frases en total.</p>
      <button type="submit" className="btn btn-primary" disabled={!editing && phrases.length >= 10}>{busy ? 'Guardando…' : editing ? 'Guardar cambios de frase' : 'Agregar frase'}</button>
      {editing && <button type="button" className="btn btn-outline-secondary ms-2" onClick={reset}>Cancelar edición</button>}
    </fieldset></form>
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className={'mt-3 text-' + (feedback.error ? 'danger' : 'success')}>{feedback.message}</p>}
  </div></section>
}
