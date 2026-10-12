import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../../context/auth-context.js'
import { LogoutButton, AccountDangerZone } from './AccountActions.jsx'
import { deleteMyAccount } from '../../services/users.service.js'
vi.mock('../../services/users.service.js', () => ({ deleteMyAccount: vi.fn() }))
const mount = (content, auth) => render(<MemoryRouter initialEntries={['/profile']}><AuthContext.Provider value={auth}><Routes><Route path="/profile" element={content} /><Route path="/login" element={<h1>Login</h1>} /></Routes></AuthContext.Provider></MemoryRouter>)
beforeEach(() => vi.resetAllMocks())
it('permite cancelar el logout y requiere confirmación antes de salir', async () => {
  const signOut = vi.fn().mockResolvedValue(undefined), user = userEvent.setup()
  mount(<LogoutButton />, { signOut })
  await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
  expect(screen.getByText('¿Querés cerrar tu sesión en Fokus?')).toBeInTheDocument()
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
  expect(signOut).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar sesión' }))
  expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument()
  expect(signOut).toHaveBeenCalledOnce()
})
it('mantiene la sesión y el diálogo si falla el cierre', async () => {
  mount(<LogoutButton />, { signOut: vi.fn().mockRejectedValue(new Error('No se pudo cerrar')) })
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar sesión' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cerrar')
  expect(screen.queryByRole('heading', { name: 'Login' })).not.toBeInTheDocument()
})
it('reautentica la eliminación, conserva errores y solo cierra sesión tras confirmar el servidor', async () => {
  const finish = vi.fn().mockResolvedValue(undefined), user = userEvent.setup()
  deleteMyAccount.mockRejectedValueOnce(new Error('Contraseña incorrecta')).mockResolvedValueOnce(null)
  mount(<AccountDangerZone />, { completeAccountDeletion: finish })
  await user.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }))
  await user.type(screen.getByLabelText('Contraseña actual'), 'test-password')
  await user.type(screen.getByLabelText('Escribí ELIMINAR para confirmar'), 'ELIMINAR')
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar cuenta' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Contraseña incorrecta')
  expect(finish).not.toHaveBeenCalled()
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar cuenta' }))
  expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument()
  expect(deleteMyAccount).toHaveBeenLastCalledWith({ password: 'test-password', confirmation: 'ELIMINAR' })
  expect(finish).toHaveBeenCalledOnce()
})
it('no permite enviar una eliminación con confirmación equivocada', async () => {
  mount(<AccountDangerZone />, { completeAccountDeletion: vi.fn() })
  await userEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }))
  await userEvent.type(screen.getByLabelText('Contraseña actual'), 'test-password')
  await userEvent.type(screen.getByLabelText('Escribí ELIMINAR para confirmar'), 'NO')
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar cuenta' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('escribí ELIMINAR')
  expect(deleteMyAccount).not.toHaveBeenCalled()
})
