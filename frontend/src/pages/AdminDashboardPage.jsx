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
  return <>
    <PageHeader eyebrow="Administración" title="Uso de Fokus" description="Estadísticas agregadas, sin información académica privada." />
    <div className="row g-3 mb-4">{[['users', 'Usuarios registrados'], ['subjects', 'Materias'], ['tasks', 'Tareas'], ['exams', 'Exámenes']].map(([key, label]) => <div className="col-6 col-xl-3" key={key}><article className="card border-0 h-100"><div className="card-body p-4"><h2 className="h6 text-secondary">{label}</h2><p className="h2 mb-0">{data.totals[key]}</p></div></article></div>)}</div>
    <div className="row g-3 mb-4"><div className="col-12 col-md-6"><article className="card border-0 h-100"><div className="card-body p-4"><h2 className="h6">Registros en los últimos 7 días</h2><p className="h2 mb-0">{data.registrations_last_7_days}</p></div></article></div><div className="col-12 col-md-6"><article className="card border-0 h-100"><div className="card-body p-4"><h2 className="h6">Usuarios con actividad académica en 7 días</h2><p className="h2">{data.active_users_last_7_days}</p><p className="small text-secondary mb-0">{data.activity_definition}</p></div></article></div></div>
    <section className="card border-0"><div className="card-body p-4"><h2 className="h5">Evolución de registros</h2><p className="small text-secondary">Últimos 30 días, agrupados por fecha UTC. Las visitas y los inicios de sesión necesitan instrumentación adicional.</p>
      <svg viewBox="0 0 600 150" className="admin-registration-chart" role="img" aria-label="Registros diarios; los valores completos están en la tabla siguiente.">{history.map((day, index) => <rect key={day.day} x={index * 20 + 2} y={140 - day.count / max * 130} width="16" height={day.count / max * 130} rx="3" fill="currentColor"><title>{day.day}: {day.count} registros</title></rect>)}</svg>
      <details className="mt-3"><summary>Ver registros por día</summary><div className="table-responsive"><table className="table"><caption>Registros diarios de usuarios</caption><thead><tr><th scope="col">Fecha UTC</th><th scope="col">Registros</th></tr></thead><tbody>{history.map(day => <tr key={day.day}><td>{day.day}</td><td>{day.count}</td></tr>)}</tbody></table></div></details>
    </div></section>
  </>
}
