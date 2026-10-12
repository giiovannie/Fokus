import { useState } from 'react'
import { FormModal } from '../ui/FormModal.jsx'
export const ExamGradeModal = ({ exam, subject, onSave, onSuccess }) => {
  const [open, setOpen] = useState(false), [grade, setGrade] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(null)
  const submit = async event => {
    event.preventDefault(); if (busy) return
    const value = Number(grade)
    if (grade.trim() === '' || !Number.isFinite(value) || value < 0 || value > 10) { setError('Ingresá una calificación entre 0 y 10.'); return }
    setBusy(true); setError(null)
    try {
      if (await onSave(value)) { setOpen(false); onSuccess?.() }
      else setError('No se pudo guardar la calificación. Volvé a intentar.')
    } catch (failure) { setError(failure.message || 'No se pudo guardar la calificación.') }
    finally { setBusy(false) }
  }
  return <>
    <div className="exam-grade-summary"><span className="small text-secondary">{exam.grade == null ? 'Sin calificar' : 'Calificación: ' + exam.grade + ' / 10'}</span><button className="btn btn-sm btn-outline-primary" type="button" aria-label={'Calificar ' + exam.title} onClick={() => { setGrade(exam.grade == null ? '' : String(exam.grade)); setError(null); setOpen(true) }}>{exam.grade == null ? 'Registrar nota' : 'Modificar nota'}</button></div>
    <FormModal open={open} title="Calificar examen" formId={'grade-form-' + exam.id} submitLabel="Guardar calificación" busy={busy} error={error} onClose={() => setOpen(false)}>
      <h3 className="h6">{exam.title}</h3><p className="small text-secondary">{subject}</p>
      <form id={'grade-form-' + exam.id} onSubmit={submit}>
        <label className="form-label" htmlFor={'exam-grade-' + exam.id}>Calificación obtenida</label>
        <div className="input-group"><input className="form-control" id={'exam-grade-' + exam.id} required type="number" min="0" max="10" step="any" value={grade} onChange={event => setGrade(event.target.value)} aria-describedby={'grade-help-' + exam.id} /><span className="input-group-text">/ 10</span></div>
        <p className="small text-secondary mt-2 mb-0" id={'grade-help-' + exam.id}>Ingresá un número entre 0 y 10. Podés usar decimales.</p>
      </form>
    </FormModal>
  </>
}
