import { useEffect, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { LoadingState, ErrorState } from '../components/ui/FeedbackState.jsx'
import { FormModal } from '../components/ui/FormModal.jsx'
import { AdminPagination } from '../components/ui/AdminPagination.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { getAdminUsers, getAdminUser, updateAdminUserStatus, deleteAdminUser } from '../services/admin.service.js'

const date = value => value ? new Date(value).toLocaleDateString('es-AR') : 'Sin datos'
export const AdminUsersPage = () => {
  const { user } = useAuth()
  const [filters, setFilters] = useState({ search: '', role: '', status: '', sort: 'createdAt', direction: 'DESC', page: 1, limit: 20 })
  const [data, setData] = useState(null), [error, setError] = useState(''), [reload, setReload] = useState(0)
  const [selected, setSelected] = useState(null), [values, setValues] = useState({ reason: '', password: '', confirmation: '' })
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState(''), [message, setMessage] = useState('')
  const [detail, setDetail] = useState(null)
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => { setData(null); setError(''); getAdminUsers(filters).then(result => { if (active) setData(result) }).catch(failure => { if (active) setError(failure.message) }) }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [filters, reload])
  const filter = (key, value) => setFilters(current => ({ ...current, [key]: value, page: 1 }))
  const select = (account, action) => { setSelected({ account, action }); setActionError(''); setValues({ reason: '', password: '', confirmation: '' }) }
  const inspect = account => { setDetail(null); setSelected({ account, action: 'detail' }); setActionError('') }
  useEffect(() => {
    if (selected?.action !== 'detail') return
    let active = true
    getAdminUser(selected.account.id).then(result => { if (active) setDetail(result) }).catch(failure => { if (active) setActionError(failure.message) })
    return () => { active = false }
  }, [selected])
  const submit = async event => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setActionError(''); setMessage('')
    try {
      if (selected.action === 'delete') await deleteAdminUser(selected.account.id, { password: values.password, confirmation: values.confirmation })
      else await updateAdminUserStatus(selected.account.id, { status: selected.action === 'suspend' ? 'suspended' : 'active', reason: values.reason, confirmation: 'CONFIRMAR' })
      setMessage(selected.action === 'delete' ? 'La cuenta fue eliminada definitivamente.' : 'El estado de la cuenta fue actualizado.')
      setSelected(null); setValues({ reason: '', password: '', confirmation: '' }); setReload(value => value + 1)
    } catch (failure) { setActionError(failure.message); setValues(current => ({ ...current, password: '' })) }
    finally { setBusy(false) }
  }
  return <>
    <PageHeader eyebrow="Administración" title="Usuarios" description="Consultá y gestioná las cuentas de la plataforma." />
    {message && <p className="alert alert-success" role="status">{message}</p>}
    <div className="card border-0 mb-3"><div className="card-body row g-3">
      <div className="col-12 col-lg-4"><label className="form-label" htmlFor="admin-user-search">Buscar por ID, nombre o email</label><input className="form-control" id="admin-user-search" value={filters.search} maxLength={160} onChange={event => filter('search', event.target.value)} /></div>
      <div className="col-6 col-lg-2"><label className="form-label" htmlFor="admin-user-role">Rol</label><select className="form-select" id="admin-user-role" value={filters.role} onChange={event => filter('role', event.target.value)}><option value="">Todos</option><option value="student">Estudiante</option><option value="superadmin">Superadmin</option></select></div>
      <div className="col-6 col-lg-2"><label className="form-label" htmlFor="admin-user-status">Estado</label><select className="form-select" id="admin-user-status" value={filters.status} onChange={event => filter('status', event.target.value)}><option value="">Todos</option><option value="active">Activa</option><option value="suspended">Suspendida</option></select></div>
      <div className="col-6 col-lg-2"><label className="form-label" htmlFor="admin-user-sort">Ordenar por</label><select className="form-select" id="admin-user-sort" value={filters.sort} onChange={event => filter('sort', event.target.value)}>{[['createdAt', 'Registro'], ['id', 'ID'], ['email', 'Email'], ['role', 'Rol'], ['status', 'Estado']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      <div className="col-6 col-lg-2"><label className="form-label" htmlFor="admin-user-direction">Orden</label><select className="form-select" id="admin-user-direction" value={filters.direction} onChange={event => filter('direction', event.target.value)}><option value="DESC">Descendente</option><option value="ASC">Ascendente</option></select></div>
    </div></div>
    {error ? <ErrorState message={error} onRetry={() => setReload(value => value + 1)} /> : !data ? <LoadingState message="Cargando usuarios…" /> : <section className="card border-0"><div className="card-body">
      <div className="table-responsive"><table className="table align-middle admin-users-table"><caption>Usuarios registrados. La última visita no se registra.</caption><thead><tr>{['ID', 'Usuario', 'Email', 'Registro', 'Rol', 'Estado', 'Acciones'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>
        {data.users.map(account => <tr key={account.id}><td>{account.id}</td><td>{account.username || 'Sin nombre'}</td><td className="text-break">{account.email}</td><td>{date(account.createdAt)}</td><td>{account.role === 'student' ? 'Estudiante' : 'Superadmin'}</td><td><span className={'badge text-bg-' + (account.status === 'suspended' ? 'warning' : 'success')}>{account.status === 'suspended' ? 'Suspendida' : 'Activa'}</span></td><td><div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => inspect(account)}>Detalles</button>
          <button className="btn btn-sm btn-outline-primary" type="button" disabled={account.id === user.id} onClick={() => select(account, account.status === 'suspended' ? 'reactivate' : 'suspend')}>{account.status === 'suspended' ? 'Reactivar' : 'Suspender'}</button>
          <button className="btn btn-sm btn-outline-danger" type="button" disabled={account.id === user.id} onClick={() => select(account, 'delete')}>Eliminar</button>
        </div></td></tr>)}
        {!data.users.length && <tr><td colSpan={7}>No hay cuentas que coincidan con la búsqueda.</td></tr>}
      </tbody></table></div><AdminPagination {...data} onPage={page => setFilters(current => ({ ...current, page }))} />
    </div></section>}
    <FormModal open={!!selected} title={selected?.action === 'detail' ? 'Detalles administrativos' : selected?.action === 'delete' ? 'Eliminar cuenta definitivamente' : selected?.action === 'suspend' ? 'Suspender cuenta' : 'Reactivar cuenta'} onClose={() => { setSelected(null); setValues({ reason: '', password: '', confirmation: '' }) }} busy={busy} error={actionError} danger={selected?.action === 'delete'} formId={selected?.action === 'detail' ? undefined : 'admin-user-action'} submitLabel="Confirmar">
      {selected?.action === 'detail' ? detail ? <><p><strong>{detail.user.email}</strong> · ID {detail.user.id}</p><p>{detail.totals.subjects} materias · {detail.totals.teachers} profesores</p><p className="small text-secondary">{detail.activity_note}</p><h3 className="h6">Últimas acciones administrativas</h3>{detail.events.length ? <ul>{detail.events.map(item => <li key={item.id}>{item.action === 'suspend' ? 'Suspensión' : 'Reactivación'} · {date(item.createdAt)} · Administrador {item.actor_id ?? 'eliminado'}{item.reason && ': ' + item.reason}</li>)}</ul> : <p>Sin acciones registradas.</p>}</> : !actionError && <LoadingState message="Cargando detalles…" /> : <form id="admin-user-action" onSubmit={submit}>
        <p>Cuenta: <strong>{selected?.account.email}</strong> (ID {selected?.account.id})</p>
        {selected?.action === 'delete' ? <><p className="alert alert-warning">Esta acción es irreversible. Se eliminarán todos los datos y las fotografías de esta cuenta.</p><label className="form-label" htmlFor="admin-delete-confirmation">Escribí ELIMINAR</label><input className="form-control mb-3" id="admin-delete-confirmation" required pattern="ELIMINAR" autoComplete="off" value={values.confirmation} onChange={event => setValues({ ...values, confirmation: event.target.value })} /><label className="form-label" htmlFor="admin-delete-password">Tu contraseña de superadministrador</label><input className="form-control" type="password" id="admin-delete-password" autoComplete="current-password" required maxLength={72} value={values.password} onChange={event => setValues({ ...values, password: event.target.value })} /></> : <><p>{selected?.action === 'suspend' ? 'Se bloqueará el acceso y el envío de nuevos recordatorios. Sus datos se conservarán.' : 'La cuenta volverá a tener acceso y podrá recibir próximos recordatorios.'}</p><label className="form-label" htmlFor="admin-status-reason">Motivo (opcional)</label><textarea className="form-control" id="admin-status-reason" maxLength={500} rows={3} value={values.reason} onChange={event => setValues({ ...values, reason: event.target.value })} /></>}
      </form>}
    </FormModal>
  </>
}
