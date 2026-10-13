import { useState } from 'react'
import { useAppData } from '../../hooks/useAppData.js'
import { FormModal } from '../ui/FormModal.jsx'
import { SubjectForm } from './SubjectForm.jsx'
import { TeacherForm } from './TeacherForm.jsx'

export const AssistedSubjectCreation = ({ open, onReturn, onCreated }) => {
  const { data, addItem } = useAppData()
  const [form, setForm] = useState({ name: '', teacher_id: '' })
  const [teacherName, setTeacherName] = useState('')
  const [teacherStep, setTeacherStep] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const submit = async event => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(null)
    let created
    const success = teacherStep
      ? await addItem('teachers', { name: teacherName.trim() }, row => { created = row })
      : await addItem('subjects', { name: form.name.trim(), teacher_id: Number(form.teacher_id) }, row => { created = row })
    setBusy(false)
    if (!success || !created?.id) { setError('No se pudo guardar. Tus datos se conservaron; revisalos y volvé a intentar.'); return }
    if (teacherStep) {
      setForm(current => ({ ...current, teacher_id: String(created.id) })); setTeacherName(''); setTeacherStep(false)
    } else {
      setForm({ name: '', teacher_id: '' }); onCreated(created.id)
    }
  }
  return <FormModal open={open} title={teacherStep ? 'Crear profesor' : 'Crear materia'} formId={teacherStep ? 'create-teacher-form' : 'create-subject-form'} submitLabel={teacherStep ? 'Guardar profesor y volver' : 'Guardar materia y volver'} busy={busy} error={error} onClose={() => {
    setError(null)
    if (teacherStep) setTeacherStep(false)
    else onReturn()
  }}>
    {teacherStep ? <TeacherForm name={teacherName} onChange={setTeacherName} onSubmit={submit} /> : <SubjectForm form={form} teachers={data.teachers} onChange={(field, value) => setForm(current => ({ ...current, [field]: value }))} onSubmit={submit} onAddTeacher={() => { setError(null); setTeacherStep(true) }} />}
  </FormModal>
}
