import { useState } from 'react'
import { FormModal } from '../components/ui/FormModal.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { ConfirmButton } from '../components/ui/ConfirmButton.jsx'
import { useAppData } from '../hooks/useAppData.js'
import { SubjectForm } from '../components/common/SubjectForm.jsx'
import { TeacherForm } from '../components/common/TeacherForm.jsx'

const emptySubject = { name: '', teacher_id: '' }

const SubjectsPage = () => {
  const { data, addItem, updateItem, removeItem, notify } = useAppData()
  const [form, setForm] = useState(emptySubject)
  const [editingId, setEditingId] = useState(null)
  const [teacherName, setTeacherName] = useState('')
  const [dialog, setDialog] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const submitSubject = async (event) => {
    event.preventDefault()
    if (saving) return
    if (!form.name || !form.teacher_id) return notify('Completá la materia y el profesor.', 'danger')
    const values = { ...form, teacher_id: Number(form.teacher_id) }
    setSaving(true); setFormError(null)
    const succeeded = editingId
      ? await updateItem('subjects', editingId, values)
      : await addItem('subjects', values)
    setSaving(false)
    if (!succeeded) { setFormError('No se pudo guardar la materia. Revisá los datos y volvé a intentar.'); return }
    setDialog(null)
    notify(editingId ? 'Materia actualizada.' : 'Materia creada.')
    setForm(emptySubject)
    setEditingId(null)
  }

  const submitTeacher = async (event) => {
    event.preventDefault()
    if (saving) return
    if (!teacherName.trim()) return
    setSaving(true); setFormError(null)
    const values = { name: teacherName.trim() }
    const succeeded = await addItem('teachers', values)
    setSaving(false)
    if (!succeeded) { setFormError('No se pudo agregar el profesor. Volvé a intentar.'); return }
    setDialog(null)
    setTeacherName('')
    notify('Profesor agregado.')
  }

  const subjectForm = <SubjectForm form={form} teachers={data.teachers} editing={Boolean(editingId)} onChange={(field, value) => setForm(current => ({ ...current, [field]: value }))} onSubmit={submitSubject} onCancel={() => { setEditingId(null); setForm(emptySubject) }} />
  const teacherForm = <TeacherForm name={teacherName} onChange={setTeacherName} onSubmit={submitTeacher} />
  return (
    <>
      <PageHeader eyebrow="Cursada" title="Materias" description="Administrá tus materias y profesores.">
        <div className="d-flex flex-wrap gap-2"><button className="btn btn-primary" type="button" data-tour="subject-create" onClick={() => { setEditingId(null); setForm(emptySubject); setFormError(null); setDialog('subject') }}>Crear materia</button><button className="btn btn-outline-secondary" type="button" data-tour="teacher-create" onClick={() => { setTeacherName(''); setFormError(null); setDialog('teacher') }}>Agregar profesor</button></div>
      </PageHeader>
      <div className="row g-4">
        <div className={editingId ? "col-12 col-xl-8" : "col-12"}>
          {data.subjects.length === 0 ? <EmptyState mascot="guide" title="Todavía no hay materias" message="Creá tu primera materia para comenzar." /> : (
            <div className="row g-3">
              {data.subjects.map((subject) => {
                const teacher = data.teachers.find(({ id }) => id === subject.teacher_id)
                const taskCount = data.tasks.filter(({ subject_id }) => subject_id === subject.id).length
                return (
                  <div className="col-12 col-md-6" key={subject.id}>
                    <article id={'subject-' + subject.id} tabIndex="-1" className="card subject-card border-0 h-100"><div className="card-body p-4">
                      <div className="subject-color mb-3" /><h2 className="h5">{subject.name}</h2>
                      <p className="text-secondary mb-3">Profesor/a: {teacher?.name ?? 'Sin asignar'}</p>
                      <span className="badge bg-light text-dark mb-4">{taskCount} tareas</span>
                      <div className="d-flex gap-2">
                        <button className="btn btn-sm btn-outline-primary" onClick={() => { setEditingId(subject.id); setForm({ name: subject.name, teacher_id: subject.teacher_id }) }} type="button">Editar</button>
                        <ConfirmButton message={`¿Eliminar la materia ${subject.name}?`} onConfirm={async () => { if (await removeItem('subjects', subject.id)) notify('Materia eliminada.', 'warning') }}>Eliminar</ConfirmButton>
                      </div>
                    </div></article>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {editingId && <div className="col-12 col-xl-4"><div className="card border-0"><div className="card-body p-4"><h2 className="h5">Editar materia</h2>{subjectForm}</div></div></div>}
      </div>
      <FormModal open={dialog !== null} title={dialog === 'subject' ? 'Crear materia' : 'Agregar profesor'} formId={dialog === 'subject' ? 'create-subject-form' : 'create-teacher-form'} submitLabel={dialog === 'subject' ? 'Crear materia' : 'Agregar'} busy={saving} error={formError} onClose={() => setDialog(null)}>{dialog === 'subject' ? subjectForm : teacherForm}</FormModal>
    </>
  )
}

export { SubjectsPage }
