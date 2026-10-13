export const TeacherForm = ({ name, onChange, onSubmit }) => <form id="create-teacher-form" onSubmit={onSubmit}>
  <label className="form-label" htmlFor="teacher-name">Nombre del profesor</label>
  <input className="form-control" id="teacher-name" required maxLength="160" value={name} onChange={event => onChange(event.target.value)} placeholder="Nombre completo" autoFocus />
</form>
