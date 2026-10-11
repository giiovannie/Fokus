import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { useAppData } from '../hooks/useAppData.js'

const icons = { exam: '◫', task: '✓', study_activity: '◎' }

const NotificationsPage = () => {
  const { data, updateItem, notify, refreshNotifications } = useAppData()
  useEffect(() => { refreshNotifications() }, [refreshNotifications])
  const unread = data.notifications.filter(({ read }) => !read).length

  const markAll = () => {
    data.notifications.forEach(({ id }) => updateItem('notifications', id, { read: true }))
    notify('Notificaciones marcadas como leídas.')
  }

  return (
    <>
      <PageHeader eyebrow="Actividad" title="Notificaciones" description={`${unread} notificaciones sin leer`}>
        <div className="d-flex flex-wrap gap-2"><Link className="btn btn-primary" to="/notifications/preferences">Configurar recordatorios</Link>
        {unread > 0 && <button className="btn btn-outline-primary" onClick={markAll} type="button">Marcar todas como leídas</button>}</div>
      </PageHeader>
      <div className="card border-0"><div className="card-body p-3 p-md-4">
        {data.notifications.length === 0 ? <EmptyState title="Todo al día" message="No tenés notificaciones nuevas." /> : data.notifications.map((notification) => <button className={`notification-row w-100 text-start ${notification.read ? '' : 'is-unread'}`} key={notification.id} onClick={() => updateItem('notifications', notification.id, { read: true })} type="button"><span className="notification-icon" aria-hidden="true">{icons[notification.type] ?? '•'}</span><span><strong style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{notification.message}</strong><small className="d-block text-secondary">{notification.read ? 'Leída' : 'Nueva'}</small></span></button>)}
      </div></div>
    </>
  )
}

export { NotificationsPage }
