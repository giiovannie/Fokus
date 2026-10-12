import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { Brand } from '../components/common/Brand.jsx'
import { ThemeToggle } from '../components/common/ThemeToggle.jsx'

export const AdminLayout = () => {
  const { signOut } = useAuth()
  const location = useLocation()
  useEffect(() => { document.getElementById('main-content')?.focus() }, [location.pathname])
  return <div className="min-vh-100 admin-shell">
    <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
    <header className="border-bottom"><div className="container py-3 d-flex align-items-center justify-content-between gap-3 flex-wrap">
      <Brand /><span className="small text-secondary">Administración de Fokus</span>
      <div className="d-flex gap-2"><ThemeToggle /><button className="btn btn-outline-secondary" type="button" onClick={signOut}>Cerrar sesión</button></div>
    </div></header>
    <nav className="container py-3 d-flex gap-2 flex-wrap" aria-label="Administración">
      {[['/admin', 'Resumen'], ['/admin/users', 'Usuarios'], ['/admin/subjects', 'Materias'], ['/admin/system', 'Sistema']].map(([to, label]) =>
        <NavLink key={to} to={to} end className={({ isActive }) => 'btn ' + (isActive ? 'btn-primary' : 'btn-outline-secondary')}>{label}</NavLink>)}
    </nav>
    <main className="container pb-5" id="main-content" tabIndex={-1}><Outlet /></main>
  </div>
}
