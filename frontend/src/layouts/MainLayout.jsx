import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '../components/common/Sidebar.jsx'
import { Topbar } from '../components/common/Topbar.jsx'
import { Toast } from '../components/ui/Toast.jsx'
import { ErrorState, LoadingState } from '../components/ui/FeedbackState.jsx'
import { useAppData } from '../hooks/useAppData.js'

const MainLayout = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const { isLoading, error, retry } = useAppData()
  const location = useLocation()

  useEffect(() => {
    if (location.hash) {
      if (isLoading) return
      const frame = window.requestAnimationFrame(() => {
        const target = document.getElementById(location.hash.slice(1))
        target?.scrollIntoView?.({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
        target?.focus({ preventScroll: true })
      })
      return () => window.cancelAnimationFrame(frame)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    window.requestAnimationFrame(() => document.querySelector('#main-content')?.focus())
  }, [location.pathname, location.hash, isLoading])

  useEffect(() => {
    if (!menuOpen) return undefined
    const closeOnEscape = (event) => event.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  return (
    <div className="app-shell min-vh-100">
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
      <div className={`sidebar-panel ${menuOpen ? 'is-open' : ''}`}>
        <Sidebar onNavigate={() => setMenuOpen(false)} />
      </div>
      {menuOpen && <button className="sidebar-backdrop" onClick={() => setMenuOpen(false)} type="button" aria-label="Cerrar navegación" />}
      <div className="app-content">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main className="p-3 p-md-4 p-xl-5" id="main-content" tabIndex="-1">
          <div className="content-container">
            {isLoading ? <LoadingState message="Preparando todo..." /> : error ? <ErrorState message={error} onRetry={retry} /> : <Outlet />}
          </div>
        </main>
      </div>
      <Toast />
    </div>
  )
}

export { MainLayout }
