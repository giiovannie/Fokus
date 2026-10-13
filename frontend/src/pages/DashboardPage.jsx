import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { StatCard } from '../components/ui/StatCard.jsx'
import { useAppData } from '../hooks/useAppData.js'
import { daysRemaining, formatDate, urgencyClass } from '../utils/date.js'

const DashboardPage = () => {
  const { data } = useAppData()
  const pendingTasks = data.tasks.filter(({ status }) => status !== 'completed')
  const upcomingExams = data.exams.filter(({ exam_date }) => daysRemaining(exam_date) >= 0)
  const unread = data.notifications.filter(({ read }) => !read).length

  return (
    <>
      <PageHeader eyebrow="Resumen" title={`Buen día, ${data.profile.name}`} description="Estas son tus prioridades académicas." />
      <div className="row g-3 mb-4" data-tour="dashboard-stats">
        <div className="col-6 col-xl-3"><StatCard label="Materias" value={data.subjects.length} detail="En curso" /></div>
        <div className="col-6 col-xl-3"><StatCard label="Tareas pendientes" value={pendingTasks.length} detail="Por completar" tone="warning" /></div>
        <div className="col-6 col-xl-3"><StatCard label="Próximos exámenes" value={upcomingExams.length} detail="Agendados" tone="info" /></div>
        <div className="col-6 col-xl-3"><StatCard label="Notificaciones" value={unread} detail="Sin leer" tone="success" /></div>
      </div>
      <div className="row g-4" data-tour="dashboard-upcoming">
        <div className="col-12 col-xl-7">
          <section className="card border-0 h-100">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center mb-3"><h2 className="h5 mb-0">Próximas entregas</h2><Link to="/tasks">Ver tareas</Link></div>
              <div className="d-grid gap-3">
                {pendingTasks.slice(0, 3).map((task) => (
                  <div className="list-row" key={task.id}>
                    <div><strong>{task.title}</strong><p className="small text-secondary mb-0">{data.subjects.find(({ id }) => id === task.subject_id)?.name}</p></div>
                    <span className="small fw-semibold">{formatDate(task.due_date)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
        <div className="col-12 col-xl-5">
          <section className="card border-0 h-100">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center mb-3"><h2 className="h5 mb-0">Exámenes</h2><Link to="/exams">Ver todos</Link></div>
              {upcomingExams.slice(0, 3).map((exam) => {
                const days = daysRemaining(exam.exam_date)
                return <div className="list-row" key={exam.id}><div><strong>{exam.title}</strong><p className="small text-secondary mb-0">{formatDate(exam.exam_date)}</p></div><span className={`badge text-bg-${urgencyClass(days)}`}>{days === 0 ? 'Hoy' : `${days} días`}</span></div>
              })}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

export { DashboardPage }
