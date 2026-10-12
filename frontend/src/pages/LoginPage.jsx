import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { hasErrors, validateLogin } from '../utils/validators.js'

const LoginPage = () => {
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [requestError, setRequestError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signIn, sessionMessage } = useAuth()
  const navigate = useNavigate()

  const submit = async (event) => {
    event.preventDefault()
    const validation = validateLogin(form)
    setErrors(validation)
    if (hasErrors(validation)) return

    setRequestError('')
    setIsSubmitting(true)
    try {
      const account = await signIn(form)
      navigate(account?.role === 'superadmin' ? '/admin' : '/')
    } catch (error) {
      setRequestError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="card auth-card border-0 shadow-sm">
      <div className="card-body p-4 p-md-5">
        <p className="section-eyebrow mb-2">Bienvenido de nuevo</p>
        <h1 className="h3 mb-2">Iniciá sesión</h1>
        <p className="text-secondary mb-4">Continuá organizando tu cursada.</p>
        {sessionMessage && <div className="alert alert-info" role="alert">{sessionMessage}</div>}
        <form className="login-form" onSubmit={submit} noValidate>
          <label className="form-label" htmlFor="login-email">Email</label>
          <input aria-describedby={errors.email ? 'login-email-error' : undefined} aria-invalid={Boolean(errors.email)} autoComplete="email" className={`form-control ${errors.email ? 'is-invalid' : ''}`} id="login-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="estudiante@email.com" />
          <div className="invalid-feedback mb-3" id="login-email-error">{errors.email}</div>
          <label className="form-label" htmlFor="login-password">Contraseña</label>
          <input aria-describedby={errors.password ? 'login-password-error' : undefined} aria-invalid={Boolean(errors.password)} autoComplete="current-password" className={`form-control ${errors.password ? 'is-invalid' : ''}`} id="login-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="••••••••" />
          <div className="invalid-feedback mb-4" id="login-password-error">{errors.password}</div>
          {requestError && <div className="alert alert-danger" role="alert">{requestError}</div>}
          <button className="btn btn-primary w-100" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <p className="text-center mt-4 mb-0">¿No tenés cuenta? <Link to="/register">Registrate</Link></p>
      </div>
    </div>
  )
}

export { LoginPage }
