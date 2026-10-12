import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormModal } from '../ui/FormModal.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { deleteMyAccount } from '../../services/users.service.js'

export const LogoutButton = ({ disabled = false }) => {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(null)
  const submit = async event => {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(null)
    try { await signOut(); navigate('/login', { replace: true }) }
    catch (failure) { setError(failure.message || 'No se pudo cerrar la sesión.') }
    finally { setBusy(false) }
  }
  return <><button className="btn btn-outline-danger" type="button" disabled={disabled} onClick={() => { setError(null); setOpen(true) }}>Cerrar sesión</button>
    <FormModal open={open} title="Cerrar sesión" formId="logout-confirm-form" submitLabel="Cerrar sesión" busy={busy} error={error} onClose={() => setOpen(false)}>
      <form id="logout-confirm-form" onSubmit={submit}><p className="mb-0">¿Querés cerrar tu sesión en Fokus?</p></form>
    </FormModal></>
}

export const AccountDangerZone = () => {
  const { user, completeAccountDeletion } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(null)
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('')
  const submit = async event => {
    event.preventDefault(); if (busy) return
    if (confirmation !== 'ELIMINAR' || !password) { setError('Ingresá tu contraseña y escribí ELIMINAR.'); return }
    setBusy(true); setError(null)
    try {
      await deleteMyAccount({ password, confirmation })
      const ended = await completeAccountDeletion(user?.id)
      if (ended !== false) navigate('/login', { replace: true })
    } catch (failure) { setError(failure.message || 'No se pudo eliminar la cuenta. No se confirmó la eliminación.') }
    finally { setBusy(false) }
  }
  const close = () => { setOpen(false); setPassword(''); setConfirmation('') }
  return <section className="card border border-danger mt-4" aria-labelledby="delete-account-title"><div className="card-body p-4">
    <h2 className="h5" id="delete-account-title">Eliminar cuenta</h2>
    <p className="text-secondary">Esta acción es irreversible: elimina tu perfil, foto, materias, profesores, tareas, exámenes y configuración de notificaciones.</p>
    <button className="btn btn-outline-danger" type="button" onClick={() => { setError(null); setOpen(true) }}>Eliminar mi cuenta</button>
    <FormModal open={open} title="Eliminar cuenta definitivamente" danger formId="delete-account-form" submitLabel="Eliminar cuenta" busy={busy} error={error} onClose={close}>
      <p>Se eliminarán tus datos y se detendrán tus recordatorios. No podés recuperar la cuenta desde Fokus.</p>
      <form id="delete-account-form" onSubmit={submit}>
        <label className="form-label" htmlFor="delete-account-password">Contraseña actual</label><input className="form-control mb-3" id="delete-account-password" type="password" autoComplete="current-password" required maxLength="72" value={password} onChange={event => setPassword(event.target.value)} />
        <label className="form-label" htmlFor="delete-account-confirmation">Escribí ELIMINAR para confirmar</label><input className="form-control" id="delete-account-confirmation" required value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" />
      </form>
    </FormModal>
  </div></section>
}
