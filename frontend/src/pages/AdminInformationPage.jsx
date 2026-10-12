import { useEffect, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { LoadingState, ErrorState } from '../components/ui/FeedbackState.jsx'
import { AdminPagination } from '../components/ui/AdminPagination.jsx'
import { getAdminSubjects, getAdminSystem } from '../services/admin.service.js'

export const AdminSubjectsPage = () => {
  const [filters, setFilters] = useState({ search: '', page: 1, limit: 20, direction: 'DESC' })
  const [data, setData] = useState(null), [error, setError] = useState(''), [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => { setData(null); setError(''); getAdminSubjects(filters).then(result => { if (active) setData(result) }).catch(failure => { if (active) setError(failure.message) }) }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [filters, reload])
  return <><PageHeader eyebrow="Administración" title="Materias" description="Nombres equivalentes agrupados para estadísticas; los registros originales se conservan." />
    <div className="row g-3 mb-4"><div className="col-12 col-md-8"><label className="form-label" htmlFor="admin-subject-search">Buscar materia</label><input className="form-control" id="admin-subject-search" maxLength={160} value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value, page: 1 })} /></div><div className="col-12 col-md-4"><label className="form-label" htmlFor="admin-subject-sort">Frecuencia</label><select className="form-select" id="admin-subject-sort" value={filters.direction} onChange={event => setFilters({ ...filters, direction: event.target.value, page: 1 })}><option value="DESC">Mayor a menor</option><option value="ASC">Menor a mayor</option></select></div></div>
    {error ? <ErrorState message={error} onRetry={() => setReload(value => value + 1)} /> : !data ? <LoadingState message="Agrupando materias…" /> : <>
      <p className="text-secondary">{data.totalUnique} materias únicas · {data.totalRegistrations} registros</p>
      {!!data.topSubjects.length && <section className="card border-0 mb-4"><div className="card-body"><h2 className="h5">Más frecuentes</h2><ul className="mb-0">{data.topSubjects.map(item => <li key={item.name}>{item.name}: {item.frequency}</li>)}</ul></div></section>}
      <section className="card border-0"><div className="card-body"><div className="table-responsive"><table className="table"><caption>Agrupación por espacios, mayúsculas y tildes.</caption><thead><tr><th scope="col">Materia</th><th scope="col">Registros</th><th scope="col">Nombres originales</th></tr></thead><tbody>{data.subjects.map(item => <tr key={item.key}><th scope="row">{item.name}</th><td>{item.frequency}</td><td><details><summary>{item.variant_count ?? item.variants.length} variantes</summary>{item.variant_count > item.variants.length && <p className="small text-secondary">Se muestran las primeras 20 variantes.</p>}<ul>{item.variants.map(name => <li key={name}>{name}</li>)}</ul></details></td></tr>)}{!data.subjects.length && <tr><td colSpan={3}>No hay materias que coincidan con la búsqueda.</td></tr>}</tbody></table></div><AdminPagination {...data} onPage={page => setFilters({ ...filters, page })} /></div></section>
    </>}
  </>
}

export const AdminSystemPage = () => {
  const [data, setData] = useState(null), [error, setError] = useState(''), [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => { setData(null); setError(''); getAdminSystem().then(result => { if (active) setData(result) }).catch(failure => { if (active) setError(failure.message) }) }, 0)
    return () => { active = false; clearTimeout(timer) }
  }, [reload])
  return <><PageHeader eyebrow="Administración" title="Sistema" description="Información operativa verificable de Fokus."><button className="btn btn-outline-primary" type="button" onClick={() => setReload(value => value + 1)}>Actualizar</button></PageHeader>
    {error ? <ErrorState message={error} onRetry={() => setReload(value => value + 1)} /> : !data ? <LoadingState message="Comprobando sistema…" /> : <section className="card border-0"><div className="card-body p-4"><dl className="row">
      <dt className="col-sm-5">API</dt><dd className="col-sm-7">{data.api === 'ok' ? 'Disponible' : 'No disponible'}</dd>
      <dt className="col-sm-5">MySQL</dt><dd className="col-sm-7">{data.database === 'ok' ? 'Conectado' : 'No disponible'}</dd>
      <dt className="col-sm-5">Versión</dt><dd className="col-sm-7">{data.application_version}</dd>
      {data.notifications && <><dt className="col-sm-5">Procesador de recordatorios</dt><dd className="col-sm-7">{data.notifications.enabled ? 'Habilitado' : 'Deshabilitado'}</dd><dt className="col-sm-5">Recordatorios pendientes</dt><dd className="col-sm-7">{data.notifications.pending}</dd><dt className="col-sm-5">Entregas aceptadas por Push</dt><dd className="col-sm-7">{data.notifications.sent}</dd><dt className="col-sm-5">Entregas fallidas</dt><dd className="col-sm-7">{data.notifications.failed}</dd></>}
    </dl><p className="small text-secondary">{data.notifications?.note || 'Las métricas de notificaciones no están disponibles.'}</p><p className="small text-secondary mb-0">Consulta: {new Date(data.generated_at).toLocaleString('es-AR')}</p></div></section>}
  </>
}
