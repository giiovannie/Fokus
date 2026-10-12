import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { AppContext } from '../context/app-context.js'
import { NotificationsPage } from './NotificationsPage.jsx'

it('separa la frase y los detalles conservando el mensaje y la acción de lectura', () => {
  const message = 'Dejá de boludear y abrí los apuntes.\nExamen: Parcial. Materia: Matemática. Fecha: 12/10/2026. Hora: 09:00 (America/Argentina/Cordoba).'
  const updateItem = vi.fn()
  const refreshNotifications = vi.fn()
  render(<MemoryRouter><AppContext.Provider value={{ data: { notifications: [{ id: 7, type: 'exam', message, read: false }] }, updateItem, refreshNotifications, notify: vi.fn() }}><NotificationsPage /></AppContext.Provider></MemoryRouter>)
  const title = screen.getByText('Dejá de boludear y abrí los apuntes.')
  expect(title).toHaveClass('notification-title')
  const row = title.closest('button')
  expect(row.querySelector('.notification-message').textContent).toBe(message)
  expect(row.querySelector('.notification-details')).toHaveTextContent('Fecha: 12/10/2026')
  expect(row.querySelector('.notification-icon')).toHaveAttribute('aria-hidden', 'true')
  fireEvent.click(row)
  expect(updateItem).toHaveBeenCalledWith('notifications', 7, { read: true })
  expect(refreshNotifications).toHaveBeenCalledTimes(1)
})

it('presenta notificaciones leídas y mensajes sin saltos de línea', () => {
  render(<MemoryRouter><AppContext.Provider value={{ data: { notifications: [{ id: 8, type: 'study_activity', message: 'Repasar mañana', read: true }] }, updateItem: vi.fn(), refreshNotifications: vi.fn() }}><NotificationsPage /></AppContext.Provider></MemoryRouter>)
  expect(screen.getByText('Leída')).toBeInTheDocument()
  expect(screen.getByText('Repasar mañana').closest('button')).not.toHaveClass('is-unread')
})

it('confirma eliminación, conserva errores y actualiza lista y contador después del servidor', async () => {
  const remove = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
  const Harness = () => {
    const [notifications, setNotifications] = useState([{ id: 'test-id', type: 'exam', message: 'Mi frase\nDatos reales del evento', read: false }])
    return <MemoryRouter><AppContext.Provider value={{ data: { notifications }, notify: vi.fn(), refreshNotifications: vi.fn(), updateItem: vi.fn(), removeItem: async (collection, id) => { if (!await remove(collection, id)) return false; setNotifications([]); return true } }}><NotificationsPage /></AppContext.Provider></MemoryRouter>
  }
  render(<Harness />)
  await userEvent.click(screen.getByRole('button', { name: /Eliminar notificación: Mi frase/ }))
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveTextContent('No se borrarán el examen')
  expect(remove).not.toHaveBeenCalled()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo eliminar')
  expect(screen.getByText('Mi frase', { selector: '.notification-title' })).toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }))
  await waitFor(() => expect(screen.getByText('0 notificaciones sin leer')).toBeInTheDocument())
  expect(screen.queryByText('Mi frase')).not.toBeInTheDocument()
  expect(remove).toHaveBeenLastCalledWith('notifications', 'test-id')
})
