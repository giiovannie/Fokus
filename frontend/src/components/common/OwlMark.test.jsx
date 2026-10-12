import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { OwlMark } from './OwlMark.jsx'
import { LoadingState } from '../ui/FeedbackState.jsx'

it('reutiliza el búho con animación decorativa de bienvenida', () => {
  const { container } = render(<OwlMark welcome />)
  expect(container.firstChild).toHaveClass('owl-welcome')
  expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  expect(container.querySelector('img')).toHaveAttribute('src', '/icons/fokus-logo.png')
  expect(container.querySelector('img')).toHaveAttribute('alt', '')
})
it('mantiene el mensaje de carga accesible sin anunciar los puntos', () => {
  const { container } = render(<LoadingState message="Preparando todo..." />)
  expect(screen.getByRole('status')).toHaveTextContent('Preparando todo...')
  expect(container.querySelector('.owl-loading')).toBeInTheDocument()
  expect(container.querySelector('.loading-dots')).toHaveAttribute('aria-hidden', 'true')
})
