import { useState } from 'react'
import { FormModal } from '../components/ui/FormModal.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { ConfirmButton } from '../components/ui/ConfirmButton.jsx'
import { useAppData } from '../hooks/useAppData.js'

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
    const succeeded = await addItem('teachers', { name: teacherName.trim() })
    setSaving(false)
    if (!succeeded) { setFormError('No se pudo agregar el profesor. Volvé a intentar.'); return }
    setDialog(null)
    setTeacherName('')
    notify('Profesor agregado.')
  }

  const subjectForm = <form id={editingId ? undefined : "create-subject-form"} onSubmit={submitSubject}>
              <label className="form-label" htmlFor="subject-name">Nombre</label>
              <input className="form-control mb-3" id="subject-name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <label className="form-label" htmlFor="subject-teacher">Profesor</label>
              <select className="form-select mb-3" id="subject-teacher" required value={form.teacher_id} onChange={(event) => setForm({ ...form, teacher_id: event.target.value })}>
                <option value="">Seleccionar</option>{data.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
              </select>
              {editingId && <button className="btn btn-primary w-100" type="submit">{editingId ? 'Guardar cambios' : 'Crear materia'}</button>}
              {editingId && <button className="btn btn-link w-100 mt-2" onClick={() => { setEditingId(null); setForm(emptySubject) }} type="button">Cancelar</button>}
            </form>
  const teacherForm = <form id="create-teacher-form" onSubmit={submitTeacher}>
    <label className="form-label" htmlFor="teacher-name">Nombre del profesor</label>
    <input className="form-control" id="teacher-name" required value={teacherName} onChange={(event) => setTeacherName(event.target.value)} placeholder="Nombre completo" />
  </form>

  return (
    <>
      <PageHeader eyebrow="Cursada" title="Materias" description="Administrá tus materias y profesores.">
        <div className="d-flex flex-wrap gap-2"><button className="btn btn-primary" type="button" onClick={() => { setEditingId(null); setForm(emptySubject); setFormError(null); setDialog('subject') }}>Crear materia</button><button className="btn btn-outline-secondary" type="button" onClick={() => { setTeacherName(''); setFormError(null); setDialog('teacher') }}>Agregar profesor</button></div>
      </PageHeader>
      <div className="row g-4">
        <div className={editingId ? "col-12 col-xl-8" : "col-12"}>
          {data.subjects.length === 0 ? <EmptyState title="Todavía no hay materias" message="Creá tu primera materia para comenzar." /> : (
            <div className="row g-3">
              {data.subjects.map((subject) => {
                const teacher = data.teachers.find(({ id }) => id === subject.teacher_id)
                const taskCount = data.tasks.filter(({ subject_id }) => subject_id === subject.id).length
                return (
                  <div className="col-12 col-md-6" key={subject.id}>
                    <article className="card subject-card border-0 h-100"><div className="card-body p-4">
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
