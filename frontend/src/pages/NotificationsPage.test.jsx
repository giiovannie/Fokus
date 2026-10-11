import { render, screen, fireEvent } from '@testing-library/react'
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
