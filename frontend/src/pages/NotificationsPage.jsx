import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { FormModal } from '../components/ui/FormModal.jsx'
import { useAppData } from '../hooks/useAppData.js'
import { formatDate } from '../utils/date.js'
const icons = { exam: '◫', task: '✓', study_activity: '◎', agenda: '▦' }
const NotificationsPage = () => {
  const { data, updateItem, removeItem, removeAllNotifications, notify, refreshNotifications } = useAppData()
  const [selected, setSelected] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(null)
  useEffect(() => { refreshNotifications() }, [refreshNotifications])
  const unread = data.notifications.filter(({ read }) => !read).length
  const markAll = () => { data.notifications.forEach(({ id }) => updateItem('notifications', id, { read: true })); notify('Notificaciones marcadas como leídas.') }
  const remove = async event => {
    event.preventDefault(); if (busy || !selected) return
    setBusy(true); setError(null)
    try {
      if (await (selected.all ? removeAllNotifications() : removeItem('notifications', selected.id))) { setSelected(null); notify(selected.all ? 'Todas las notificaciones fueron eliminadas.' : 'Notificaci?n eliminada.') }
      else setError('No se pudo eliminar la notificación. Volvé a intentar.')
    } catch { setError('No se pudo eliminar la notificación. Volvé a intentar.') }
    finally { setBusy(false) }
  }
  return <>
    <PageHeader eyebrow="Actividad" title="Notificaciones" description={`${unread} notificaciones sin leer`}>
      <div className="d-flex flex-wrap gap-2" data-tour="notification-tools"><Link className="btn btn-primary" to="/notifications/preferences">Configurar recordatorios</Link>{unread > 0 && <button className="btn btn-outline-primary" onClick={markAll} type="button">Marcar todas como leídas</button>}{data.notifications.length > 0 && <button className="btn btn-outline-danger" type="button" onClick={() => { setError(null); setSelected({ all: true }) }}>Eliminar todas</button>}</div>
    </PageHeader>
    <div className="notifications-list">
      {data.notifications.length === 0 ? <EmptyState title="Todo al día" message="No tenés notificaciones nuevas." /> : data.notifications.map(notification => <article className={`notification-card ${notification.read ? '' : 'is-unread'}`} key={notification.id}>
        <button className="notification-open" type="button" onClick={() => updateItem('notifications', notification.id, { read: true })}>
          <span className="notification-icon" aria-hidden="true">{icons[notification.type] ?? '•'}</span>
          <span className="notification-content"><span className="notification-message">{notification.message.split('\n').map((line, index, lines) => <span className={index === 0 ? 'notification-title' : 'notification-details'} key={index}>{line}{index < lines.length - 1 ? '\n' : ''}</span>)}</span>
            <small className="notification-status">{notification.read ? 'Leída' : 'Nueva'}{notification.date && <> · <time dateTime={notification.date}>{formatDate(notification.date)}</time></>}</small>
          </span>
        </button>
        <button className="btn btn-sm btn-outline-secondary notification-delete" type="button" aria-label={'Eliminar notificación: ' + notification.message} onClick={() => { setError(null); setSelected(notification) }}><span aria-hidden="true">×</span></button>
      </article>)}
    </div>
    <FormModal open={!!selected} title="Eliminar notificación" danger formId="dismiss-notification-form" submitLabel="Eliminar" busy={busy} error={error} onClose={() => setSelected(null)}><form id="dismiss-notification-form" onSubmit={remove}>{selected && !selected.all && <p className="notification-message text-secondary">{selected.message}</p>}<p className="mb-0">Se quitará de tu bandeja. No se borrarán el examen o la tarea, ni se cancelarán futuros recordatorios.</p></form></FormModal>
  </>
}
export { NotificationsPage }
