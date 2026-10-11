import { useEffect, useState } from 'react'

export const ThemeToggle = () => {
  const [dark, setDark] = useState(() => document.documentElement.dataset.bsTheme === 'dark')
  useEffect(() => {
    const sync = event => {
      if (event.key !== 'fokus-theme' && event.key !== null) return
      const theme = event.newValue === 'dark' ? 'dark' : 'light'
      document.documentElement.dataset.bsTheme = theme
      document.documentElement.style.colorScheme = theme
      setDark(theme === 'dark')
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const toggle = () => {
    const next = !dark
    const theme = next ? 'dark' : 'light'
    document.documentElement.dataset.bsTheme = theme
    document.documentElement.style.colorScheme = theme
    setDark(next)
    try { localStorage.setItem('fokus-theme', theme) } catch { /* El selector funciona aunque no se pueda guardar. */ }
  }
  return <button type="button" className="btn btn-outline-secondary theme-toggle" aria-label="Modo oscuro" aria-pressed={dark} onClick={toggle}>
    <span aria-hidden="true">{dark ? '☾' : '☀'}</span> <span>{dark ? 'Oscuro' : 'Claro'}</span>
  </button>
}
