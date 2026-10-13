import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

const html = readFileSync('index.html', 'utf8')
describe('apertura antes de cargar React', () => {
  it('incluye búho y carga accesible en el HTML inicial sin depender del bundle', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const splash = doc.querySelector('#root .boot-splash')
    expect(splash.getAttribute('role')).toBe('status')
    expect(splash.getAttribute('aria-live')).toBe('polite')
    expect(splash.textContent).toContain('Preparando todo...')
    expect(splash.querySelector('img').getAttribute('src')).toBe('/mascotas/buho-mirada-fija-160.webp')
    expect(splash.querySelector('.boot-dots').getAttribute('aria-hidden')).toBe('true')
    expect(html).toContain('prefers-reduced-motion: reduce')
    expect(html).toContain('html[data-bs-theme="dark"]')
  })
  it('React reemplaza la apertura sin temporizadores ni espera artificial', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const container = document.createElement('div')
    container.innerHTML = doc.querySelector('#root').innerHTML
    document.body.appendChild(container)
    expect(container.querySelector('.boot-splash')).not.toBeNull()
    const view = render(<h1>Aplicación lista</h1>, { container })
    expect(screen.getByRole('heading', { name: 'Aplicación lista' })).toBeInTheDocument()
    expect(container.querySelector('.boot-splash')).toBeNull()
    view.unmount(); container.remove()
  })
})

it('incluye un badge PNG de 96 px con canal alfa y recurso de aplicación separado', () => {
  const badge = readFileSync('public/icons/fokus-badge.png')
  expect(badge.subarray(1, 4).toString()).toBe('PNG')
  expect(badge.readUInt32BE(16)).toBe(96)
  expect(badge.readUInt32BE(20)).toBe(96)
  expect(badge[25]).toBe(6) // RGBA; el alfa de la silueta fue comprobado al generar el asset.
  expect(readFileSync('public/sw.js', 'utf8')).toContain("'/icons/fokus-badge.png'")
})
