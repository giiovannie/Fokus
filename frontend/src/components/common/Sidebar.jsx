import { useAuth } from '../../hooks/useAuth.js'
import { NavLink } from 'react-router-dom'
import { Brand } from './Brand.jsx'

const links = [
  ['/', 'Resumen', '⌂'],
  ['/subjects', 'Materias', '▤'],
  ['/tasks', 'Tareas', '✓'],
  ['/exams', 'Exámenes', '◫'],
  ['/study', 'Estudio', '◎'],
  ['/roulette', 'Ruleta', '◉'],
  ['/notifications', 'Notificaciones', '●'],
  ['/profile', 'Perfil', '○'],
]

const Sidebar = ({ onNavigate }) => {
  const { user } = useAuth()
  return (
  <aside className="app-sidebar d-flex flex-column p-3">
    <div className="px-2 py-2 mb-4"><Brand /></div>
    <nav className="nav nav-pills flex-column gap-1">
      {links.map(([to, label, icon]) => (
        <NavLink
          className={({ isActive }) => `nav-link d-flex align-items-center gap-3 ${isActive ? 'active' : ''}`}
          end={to === '/'}
          key={to}
          onClick={onNavigate}
          to={to}
        >
          <span className="sidebar-icon" aria-hidden="true">{icon}</span>{label}
        </NavLink>
      ))}
      {user?.role === 'superadmin' && <NavLink className="nav-link" to="/admin" onClick={onNavigate}>Administración</NavLink>}
    </nav>
    <p className="small text-secondary px-2 mt-auto mb-0">Fokus · 2026</p>
  </aside>
)
}

export { Sidebar }
