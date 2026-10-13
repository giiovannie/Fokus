import { ExamGradeModal } from '../components/common/ExamGradeModal.jsx'
import { useState } from 'react'
import { FormModal } from '../components/ui/FormModal.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { ConfirmButton } from '../components/ui/ConfirmButton.jsx'
import { ExamForm } from '../components/common/ExamForm.jsx'
import { AssistedSubjectCreation } from '../components/common/AssistedSubjectCreation.jsx'
import { useAppData } from '../hooks/useAppData.js'
import { daysRemaining, formatDate, urgencyClass } from '../utils/date.js'

const initialForm = { title: '', exam_date: '', topics: '', subject_id: '' }

const ExamsPage = () => {
  const { data, addItem, updateItem, removeItem, notify } = useAppData()
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [assisting, setAssisting] = useState(null)
  const assist = () => { setAssisting(creating ? 'modal' : 'inline'); setCreating(false) }
  const returnToExam = () => { if (assisting === 'modal') setCreating(true); setAssisting(null) }
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    if (saving) return
    if (!form.title || !form.exam_date || !form.subject_id) return notify('Completá los campos obligatorios.', 'danger')
    const values = { ...form, subject_id: Number(form.subject_id) }
    setSaving(true); setFormError(null)
    const succeeded = editingId
      ? await updateItem('exams', editingId, values)
      : await addItem('exams', { ...values, grade: null })
    setSaving(false)
    if (!succeeded) { setFormError('No se pudo guardar. Revisá los datos y volvé a intentar.'); return }
    setCreating(false)
    setForm(initialForm); setEditingId(null); notify(editingId ? 'Examen actualizado.' : 'Examen creado.')
  }

  return (
    <>
      <PageHeader eyebrow="Evaluaciones" title="Exámenes" description="Consultá fechas, temas y calificaciones.">
        <button className="btn btn-primary" type="button" data-tour="exam-create" onClick={() => { setForm(initialForm); setEditingId(null); setFormError(null); setCreating(true) }}>Crear examen</button>
      </PageHeader>
      <div className="row g-4">
        <div className={editingId ? "col-12 col-xl-8" : "col-12"}>
          {data.exams.length === 0 ? <EmptyState title="No hay exámenes" message="Agendá tu primera evaluación." /> : (
            <div className="row g-3">{data.exams.map((exam) => {
              const days = daysRemaining(exam.exam_date)
              const subject = data.subjects.find(({ id }) => id === exam.subject_id)
              return <div className="col-12 col-md-6" key={exam.id}><article id={'exam-' + exam.id} tabIndex="-1" className="card border-0 exam-card h-100"><div className="card-body p-4">
                <div className="d-flex justify-content-between gap-2 mb-3"><span className="small text-secondary">{subject?.name}</span>{exam.grade !== null ? <span className="grade-badge">Nota {exam.grade}</span> : <span className={`badge text-bg-${urgencyClass(days)}`}>{days < 0 ? 'Realizado' : days === 0 ? 'Hoy' : `${days} días`}</span>}</div>
                <h2 className="h5">{exam.title}</h2><p className="text-secondary small">{exam.topics}</p><p className="fw-semibold">{formatDate(exam.exam_date)}</p>
                <ExamGradeModal exam={exam} subject={subject?.name} onSave={grade => updateItem('exams', exam.id, { grade })} onSuccess={() => notify('Calificación guardada.')} />
                <div className="d-flex gap-2"><button className="btn btn-sm btn-outline-primary" onClick={() => { setEditingId(exam.id); setForm({ title: exam.title, exam_date: exam.exam_date, topics: exam.topics, subject_id: exam.subject_id }) }} type="button">Editar</button><ConfirmButton message={`¿Eliminar el examen ${exam.title}?`} onConfirm={async () => { if (await removeItem('exams', exam.id)) notify('Examen eliminado.', 'warning') }}>Eliminar</ConfirmButton></div>
              </div></article></div>
            })}</div>
          )}
        </div>
        {editingId && <div className="col-12 col-xl-4"><ExamForm editing={Boolean(editingId)} form={form} subjects={data.subjects} onCreateSubject={assist} onCancel={() => { setEditingId(null); setForm(initialForm) }} onChange={(field, value) => setForm({ ...form, [field]: value })} onSubmit={submit} /></div>}
      </div>
      <FormModal open={creating} title="Crear examen" formId="create-exam-form" busy={saving} error={formError} onClose={() => setCreating(false)}>
        <ExamForm inModal form={form} subjects={data.subjects} onCreateSubject={assist} onChange={(field, value) => setForm({ ...form, [field]: value })} onSubmit={submit} />
      </FormModal>
      <AssistedSubjectCreation open={Boolean(assisting)} onReturn={returnToExam} onCreated={id => { setForm(current => ({ ...current, subject_id: String(id) })); returnToExam() }} />
    </>
  )
}

export { ExamsPage }
