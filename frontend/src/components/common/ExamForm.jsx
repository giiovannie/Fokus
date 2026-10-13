const ExamForm = ({ editing, form, subjects, onCancel, onChange, onSubmit, onCreateSubject, inModal = false }) => (
  <div className={inModal ? "card border-0" : "card border-0 form-card sticky-xl-top"}>
    <div className={inModal ? "modal-form-content" : "card-body p-4"}>
      {!inModal && <h2 className="h5 mb-3">{editing ? 'Editar examen' : 'Nuevo examen'}</h2>}
      <form id={inModal ? "create-exam-form" : undefined} onSubmit={onSubmit}>
        <label className="form-label" htmlFor="exam-title">Título *</label>
        <input className="form-control mb-3" id="exam-title" required value={form.title} onChange={(event) => onChange('title', event.target.value)} />
        <label className="form-label" htmlFor="exam-subject">Materia *</label>
        <select className="form-select mb-3" id="exam-subject" required value={form.subject_id} onChange={(event) => onChange('subject_id', event.target.value)}>
          <option value="">Seleccionar</option>
          {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
        {onCreateSubject && <div className="mb-3">{!subjects.length && <p className="small text-secondary">Primero necesitás una materia. Podés crearla sin perder los datos del examen.</p>}<button className="btn btn-sm btn-outline-primary" type="button" onClick={onCreateSubject}>Crear materia aquí</button></div>}
        <label className="form-label" htmlFor="exam-date">Fecha *</label>
        <input className="form-control mb-3" id="exam-date" required type="date" value={form.exam_date} onChange={(event) => onChange('exam_date', event.target.value)} />
        <label className="form-label" htmlFor="exam-topics">Temas</label>
        <textarea className="form-control mb-3" id="exam-topics" rows="3" value={form.topics} onChange={(event) => onChange('topics', event.target.value)} />
        {!inModal && <button className="btn btn-primary w-100" type="submit">{editing ? 'Guardar cambios' : 'Crear examen'}</button>}
        {editing && <button className="btn btn-link w-100" onClick={onCancel} type="button">Cancelar</button>}
      </form>
    </div>
  </div>
)

export { ExamForm }
