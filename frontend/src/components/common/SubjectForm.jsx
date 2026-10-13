export const SubjectForm = ({ form, teachers, onChange, onSubmit, onCancel, onAddTeacher, editing = false }) => <form id={editing ? undefined : 'create-subject-form'} onSubmit={onSubmit}>
  <label className="form-label" htmlFor="subject-name">Nombre</label>
  <input className="form-control mb-3" id="subject-name" required maxLength="160" value={form.name} autoFocus onChange={event => onChange('name', event.target.value)} />
  <label className="form-label" htmlFor="subject-teacher">Profesor</label>
  <select className="form-select mb-3" id="subject-teacher" required value={form.teacher_id} onChange={event => onChange('teacher_id', event.target.value)}>
    <option value="">Seleccionar</option>{teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
  </select>
  {onAddTeacher && <><p className="small text-secondary">Para guardar una materia necesitás un profesor registrado.</p><button className="btn btn-outline-primary mb-3" type="button" onClick={onAddTeacher}>Crear profesor aquí</button></>}
  {editing && <><button className="btn btn-primary w-100" type="submit">Guardar cambios</button><button className="btn btn-link w-100" type="button" onClick={onCancel}>Cancelar</button></>}
</form>
