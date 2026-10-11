import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ThemeToggle } from './ThemeToggle.jsx'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.dataset.bsTheme = 'light'
})
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  document.documentElement.dataset.bsTheme = 'light'
  document.documentElement.style.colorScheme = 'light'
})
it('alterna con teclado y conserva la preferencia entre montajes', async () => {
  const user = userEvent.setup()
  const view = render(<ThemeToggle />)
  const button = screen.getByRole('button', { name: 'Modo oscuro' })
  expect(button).toHaveAttribute('aria-pressed', 'false')
  button.focus()
  await user.keyboard(' ')
  expect(button).toHaveAttribute('aria-pressed', 'true')
  expect(document.documentElement.dataset.bsTheme).toBe('dark')
  expect(localStorage.getItem('fokus-theme')).toBe('dark')
  view.unmount()
  render(<ThemeToggle />)
  expect(screen.getByRole('button', { name: 'Modo oscuro' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: 'Modo oscuro' }))
  expect(localStorage.getItem('fokus-theme')).toBe('light')
})
it('permite alternar cuando el navegador no permite guardar', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })
  render(<ThemeToggle />)
  await userEvent.click(screen.getByRole('button', { name: 'Modo oscuro' }))
  expect(document.documentElement.dataset.bsTheme).toBe('dark')
})
it('sincroniza cambios de preferencia desde otra pestaña', () => {
  render(<ThemeToggle />)
  fireEvent(window, new StorageEvent('storage', { key: 'fokus-theme', newValue: 'dark' }))
  expect(screen.getByRole('button', { name: 'Modo oscuro' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent(window, new StorageEvent('storage', { key: 'fokus-theme', newValue: null }))
  expect(document.documentElement.dataset.bsTheme).toBe('light')
})
