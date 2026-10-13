import { Link } from 'react-router-dom'
import { useCalendar } from '../../hooks/useCalendar.js'
import { addDays, dateLabel, eventTimeLabel, todayIn } from '../../utils/calendar.js'
export const UpcomingAgenda = () => {
  const initialDay = todayIn()
  const { events, timezone, loading, error, reload } = useCalendar(addDays(initialDay, -1), addDays(initialDay, 14), true)
  const today = todayIn(timezone)
  const localTime = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())
  const upcoming = events.filter(event => ['personal', 'academic'].includes(event.type) && (event.date > today || event.date === today && (!event.time || event.time >= localTime))).slice(0, 4)
  return <section className="card border-0 mt-4"><div className="card-body p-4">
    <div className="d-flex justify-content-between gap-2"><h2 className="h5">Próximas actividades</h2><Link to="/calendar">Ver calendario</Link></div>
    {loading ? <p role="status">Cargando agenda…</p> : error ? <><p role="alert">No se pudo cargar la agenda.</p><button className="btn btn-outline-secondary" onClick={reload}>Reintentar</button></> : !upcoming.length ? <p className="text-secondary mb-0">No tenés actividades personales o académicas próximas.</p> : upcoming.map(event => <Link className="list-row" key={event.key} to={`/calendar?date=${event.date}&event=${event.id}`}><strong>{event.title}</strong><span>{dateLabel(event.date)} · {eventTimeLabel(event)}</span></Link>)}
  </div></section>
}
