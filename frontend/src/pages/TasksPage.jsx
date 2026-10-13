import { useMemo, useState } from 'react'
import { FormModal } from '../components/ui/FormModal.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { ConfirmButton } from '../components/ui/ConfirmButton.jsx'
import { TaskForm } from '../components/common/TaskForm.jsx'
import { useAppData } from '../hooks/useAppData.js'
import { formatDate } from '../utils/date.js'

const initialForm = { title: '', description: '', due_date: '', subject_id: '' }
const statusLabels = { pending: 'Pendiente', in_progress: 'En progreso', completed: 'Completada' }

const TasksPage = () => {
  const { data, addItem, updateItem, removeItem, notify } = useAppData()
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [noteDrafts, setNoteDrafts] = useState({})
  const [editingNote, setEditingNote] = useState({ id: null, content: '' })
  const visibleTasks = useMemo(() => filter === 'all' ? data.tasks : data.tasks.filter(({ status }) => status === filter), [data.tasks, filter])

  const submit = async (event) => {
    event.preventDefault()
    if (saving) return
    if (!form.title || (form.due_date !== null && !form.due_date) || !form.subject_id) return notify('Completá los campos obligatorios.', 'danger')
    const values = { ...form, subject_id: Number(form.subject_id) }
    setSaving(true); setFormError(null)
    const succeeded = editingId
      ? await updateItem('tasks', editingId, values)
      : await addItem('tasks', { ...values, status: 'pending' })
    setSaving(false)
    if (!succeeded) { setFormError('No se pudo guardar. Revisá los datos y volvé a intentar.'); return }
    setCreating(false)
    setForm(initialForm); setEditingId(null); notify(editingId ? 'Tarea actualizada.' : 'Tarea creada.')
  }

  const addNote = async (taskId) => {
    const content = noteDrafts[taskId]?.trim()
    if (!content) return
    if (!await addItem('notes', { task_id: taskId, content })) return
    setNoteDrafts({ ...noteDrafts, [taskId]: '' }); notify('Nota agregada.')
  }

  return (
    <>
      <PageHeader eyebrow="Planificación" title="Tareas" description="Seguí pendientes, avances y tareas completadas.">
        <button className="btn btn-primary" type="button" onClick={() => { setForm(initialForm); setEditingId(null); setFormError(null); setCreating(true) }}>Crear tarea</button>
      </PageHeader>
      <div className="row g-4">
        <div className={editingId ? "col-12 col-xl-8" : "col-12"}>
          <div className="d-flex flex-wrap gap-2 mb-3">
            {[['all', 'Todas'], ['pending', 'Pendientes'], ['in_progress', 'En progreso'], ['completed', 'Completadas']].map(([value, label]) => <button className={`btn btn-sm ${filter === value ? 'btn-primary' : 'btn-light'}`} key={value} onClick={() => setFilter(value)} type="button">{label}</button>)}
          </div>
          {visibleTasks.length === 0 ? <EmptyState title="No hay tareas aquí" message="Cambiá el filtro o creá una tarea." /> : visibleTasks.map((task) => (
            <article id={'task-' + task.id} tabIndex="-1" className={`card border-0 mb-3 task-card ${task.status === 'completed' ? 'is-complete' : ''}`} key={task.id}><div className="card-body p-4">
              <div className="d-flex flex-column flex-md-row justify-content-between gap-3">
                <div><span className={`badge status-${task.status} mb-2`}>{statusLabels[task.status]}</span><h2 className="h5 mb-1">{task.title}</h2><p className="text-secondary mb-2">{task.description}</p><small>{data.subjects.find(({ id }) => id === task.subject_id)?.name} · {formatDate(task.due_date)}</small></div>
                <div className="d-flex flex-wrap align-content-start gap-2">
                  <select className="form-select form-select-sm status-select" value={task.status} onChange={async (event) => { if (await updateItem('tasks', task.id, { status: event.target.value })) notify('Estado actualizado.') }} aria-label="Estado de tarea">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  <button className="btn btn-sm btn-outline-primary" onClick={() => { setEditingId(task.id); setForm({ title: task.title, description: task.description, due_date: task.due_date, subject_id: task.subject_id }) }} type="button">Editar</button>
                  <ConfirmButton message={`¿Eliminar la tarea ${task.title}?`} onConfirm={async () => { if (await removeItem('tasks', task.id)) notify('Tarea eliminada.', 'warning') }}>Eliminar</ConfirmButton>
                </div>
              </div>
              <div className="task-notes mt-3 pt-3 border-top"><strong className="small">Notas</strong>{data.notes.filter(({ task_id }) => task_id === task.id).map((note) => <div className="note-row" key={note.id}>{editingNote.id === note.id ? <div className="input-group input-group-sm"><input aria-label="Editar contenido de la nota" className="form-control" value={editingNote.content} onChange={(event) => setEditingNote({ ...editingNote, content: event.target.value })} /><button className="btn btn-outline-primary" onClick={async () => { if (await updateItem('notes', note.id, { content: editingNote.content })) { setEditingNote({ id: null, content: '' }); notify('Nota actualizada.') } }} type="button">Guardar</button></div> : <><span>{note.content}</span><span><button className="btn btn-sm btn-link" onClick={() => setEditingNote({ id: note.id, content: note.content })} type="button">Editar</button><ConfirmButton className="btn btn-sm btn-link text-danger" message="¿Eliminar esta nota?" onConfirm={async () => { if (await removeItem('notes', note.id)) notify('Nota eliminada.', 'warning') }}>Eliminar</ConfirmButton></span></>}</div>)}<div className="input-group input-group-sm mt-2"><input aria-label={`Nueva nota para ${task.title}`} className="form-control" value={noteDrafts[task.id] ?? ''} onChange={(event) => setNoteDrafts({ ...noteDrafts, [task.id]: event.target.value })} placeholder="Nueva nota" /><button className="btn btn-outline-secondary" onClick={() => addNote(task.id)} type="button">Agregar</button></div></div>
            </div></article>
          ))}
        </div>
        {editingId && <div className="col-12 col-xl-4"><TaskForm editing={Boolean(editingId)} form={form} subjects={data.subjects} onCancel={() => { setEditingId(null); setForm(initialForm) }} onChange={(field, value) => setForm({ ...form, [field]: value })} onSubmit={submit} /></div>}
      </div>
      <FormModal open={creating} title="Crear tarea" formId="create-task-form" busy={saving} error={formError} onClose={() => setCreating(false)}>
        <TaskForm inModal form={form} subjects={data.subjects} onChange={(field, value) => setForm({ ...form, [field]: value })} onSubmit={submit} />
      </FormModal>
    </>
  )
}

export { TasksPage }
