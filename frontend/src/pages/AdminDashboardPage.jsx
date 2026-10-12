import { useEffect, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { ErrorState, LoadingState } from '../components/ui/FeedbackState.jsx'
import { getAdminStatistics } from '../services/admin.service.js'

export const AdminDashboardPage = () => {
  const [data, setData] = useState(null), [error, setError] = useState(null), [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    getAdminStatistics().then(result => { if (active) setData(result) }).catch(failure => { if (active) setError(failure.message) })
    return () => { active = false }
  }, [reload])
  if (error) return <ErrorState message={error} onRetry={() => { setError(null); setData(null); setReload(value => value + 1) }} />
  if (!data) return <LoadingState message="Cargando estadísticas…" />
  const history = data.registration_history, max = Math.max(1, ...history.map(day => day.count))
  const academicMax = Math.max(1, ...(data.academic_history ?? []).flatMap(row => [row.tasks, row.exams]))
  return <>
    <PageHeader eyebrow="Administración" title="Uso de Fokus" description="Estadísticas agregadas, sin información académica privada." />
    {data.accounts && <div className="row g-3 mb-4">{[[data.accounts.active, 'Cuentas habilitadas'], [data.accounts.suspended, 'Cuentas suspendidas'], [data.registrations.today, 'Registros hoy (UTC)'], [data.registrations.month_to_date, 'Registros este mes']].map(([value, label]) => <div className="col-6 col-xl-3" key={label}><article className="card border-0"><div className="card-body p-4"><h2 className="h6 text-secondary">{label}</h2><p className="h2 mb-0">{value}</p></div></article></div>)}</div>}
    {data.academic && <section className="card border-0 mb-4"><div className="card-body p-4"><h2 className="h5">Actividad académica y períodos</h2><p>{data.academic.tasks_with_date} tareas con vencimiento · {data.academic.tasks_without_date} sin vencimiento · {data.academic.activities} actividades de estudio.</p><p className="small text-secondary mb-0">Mes actual hasta hoy: {data.registrations.month_to_date} registros. Mes anterior completo: {data.registrations.previous_month}. Los períodos tienen distinta duración.</p></div></section>}
    <div className="row g-3 mb-4">{[['users', 'Usuarios registrados'], ['subjects', 'Materias'], ['tasks', 'Tareas'], ['exams', 'Exámenes']].map(([key, label]) => <div className="col-6 col-xl-3" key={key}><article className="card border-0 h-100"><div className="card-body p-4"><h2 className="h6 text-secondary">{label}</h2><p className="h2 mb-0">{data.totals[key]}</p></div></article></div>)}</div>
    <div className="row g-3 mb-4"><div className="col-12 col-md-6"><article className="card border-0 h-100"><div className="card-body p-4"><h2 className="h6">Registros en los últimos 7 días</h2><p className="h2 mb-0">{data.registrations_last_7_days}</p></div></article></div><div className="col-12 col-md-6"><article className="card border-0 h-100"><div className="card-body p-4"><h2 className="h6">Usuarios con actividad académica en 7 días</h2><p className="h2">{data.active_users_last_7_days}</p><p className="small text-secondary mb-0">{data.activity_definition}</p></div></article></div></div>
    <section className="card border-0"><div className="card-body p-4"><h2 className="h5">Evolución de registros</h2><p className="small text-secondary">Últimos 30 días, agrupados por fecha UTC. Las visitas y los inicios de sesión necesitan instrumentación adicional.</p>
      <svg viewBox="0 0 600 150" className="admin-registration-chart" role="img" aria-label="Registros diarios; los valores completos están en la tabla siguiente.">{history.map((day, index) => <rect key={day.day} x={index * 20 + 2} y={140 - day.count / max * 130} width="16" height={day.count / max * 130} rx="3" fill="currentColor"><title>{day.day}: {day.count} registros</title></rect>)}</svg>
      {!history.some(day => day.count) && <p>No hubo registros en este período.</p>}
      <details className="mt-3"><summary>Ver registros por día</summary><div className="table-responsive"><table className="table"><caption>Registros diarios de usuarios</caption><thead><tr><th scope="col">Fecha UTC</th><th scope="col">Registros</th></tr></thead><tbody>{history.map(day => <tr key={day.day}><td>{day.day}</td><td>{day.count}</td></tr>)}</tbody></table></div></details>
    </div></section>
    {data.academic_history && <section className="card border-0 mt-4"><div className="card-body p-4"><h2 className="h5">Creación de tareas y exámenes</h2><p className="small text-secondary">Últimos 30 días (UTC). Se cuentan los registros que todavía existen.</p>
      <svg viewBox="0 0 600 150" className="admin-registration-chart" role="img" aria-label="Tareas y exámenes creados por día"><title>Tareas en verde, exámenes en naranja</title>{data.academic_history.map((day, index) => <g key={day.day}><rect x={index * 20 + 1} y={140 - day.tasks / academicMax * 130} width="8" height={day.tasks / academicMax * 130} fill="var(--color-primary)"><title>{day.day}: {day.tasks} tareas</title></rect><rect x={index * 20 + 10} y={140 - day.exams / academicMax * 130} width="8" height={day.exams / academicMax * 130} fill="var(--color-accent)"><title>{day.day}: {day.exams} exámenes</title></rect></g>)}</svg>
      <p className="small">Tareas: verde · Exámenes: naranja</p>{!data.academic_history.some(day => day.tasks || day.exams) && <p>No hubo creaciones de tareas o exámenes en este período.</p>}
      <details><summary>Ver valores por día</summary><div className="table-responsive"><table className="table"><caption>Creación diaria de tareas y exámenes</caption><thead><tr><th scope="col">Fecha UTC</th><th scope="col">Tareas</th><th scope="col">Exámenes</th></tr></thead><tbody>{data.academic_history.map(day => <tr key={day.day}><td>{day.day}</td><td>{day.tasks}</td><td>{day.exams}</td></tr>)}</tbody></table></div></details>
    </div></section>}
  </>
}
