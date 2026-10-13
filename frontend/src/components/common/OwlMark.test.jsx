import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { OwlMark } from './OwlMark.jsx'
import { LoadingState } from '../ui/FeedbackState.jsx'

it('reutiliza el búho con animación decorativa de bienvenida', () => {
  const { container } = render(<OwlMark welcome />)
  expect(container.firstChild).toHaveClass('owl-welcome')
  expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  expect(container.querySelector('img')).toHaveAttribute('src', '/mascotas/buho-mirada-fija-320.webp')
  expect(container.querySelector('img')).toHaveAttribute('alt', '')
})
it('mantiene el mensaje de carga accesible sin anunciar los puntos', () => {
  const { container } = render(<LoadingState message="Preparando todo..." />)
  expect(screen.getByRole('status')).toHaveTextContent('Preparando todo...')
  expect(container.querySelector('.owl-loading')).toBeInTheDocument()
  expect(container.querySelector('.loading-dots')).toHaveAttribute('aria-hidden', 'true')
})
it.each([['principal', 'mirada-fija'], ['graduate', 'graduado'], ['guide', 'lentes'], ['welcome', 'saludando']])('elige la ilustración contextual %s sin depender del tema', (variant, file) => {
  const { container, rerender } = render(<OwlMark variant={variant} />)
  expect(container.querySelector('img')).toHaveAttribute('src', `/mascotas/buho-${file}-320.webp`)
  document.documentElement.setAttribute('data-theme', 'dark')
  rerender(<OwlMark variant={variant} />)
  expect(container.querySelector('img')).toHaveAttribute('srcset', expect.stringContaining(`buho-${file}-160.webp`))
  document.documentElement.removeAttribute('data-theme')
})
