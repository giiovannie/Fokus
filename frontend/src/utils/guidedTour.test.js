import { describe, expect, it } from 'vitest'
import { placeTourCard, tourSteps } from './guidedTour.js'
describe('recorrido y ubicación de tarjetas', () => {
  it('usa solo las secciones integradas y contiene ocho pasos persistibles', () => {
    expect(tourSteps).toHaveLength(8)
    expect([...new Set(tourSteps.map(step => step.path))]).toEqual(['/', '/subjects', '/tasks', '/exams', '/notifications', '/notifications/preferences'])
    expect(tourSteps.every(step => step.target && step.text)).toBe(true)
  })
  it.each([[320, 640], [360, 280], [1024, 768], [640, 240]])('mantiene la tarjeta dentro de %ix%i incluso con poco espacio', (width, height) => {
    for (const rect of [{ left: 0, right: 300, top: 0, bottom: 50 }, { left: width - 50, right: width, top: height - 40, bottom: height }, { left: -80, right: 500, top: -30, bottom: 900 }]) {
      const card = placeTourCard(rect, width, height, 400)
      expect(card.left).toBeGreaterThanOrEqual(12)
      expect(card.left + card.width).toBeLessThanOrEqual(width - 12)
      expect(card.top).toBeGreaterThanOrEqual(12)
      expect(card.top + Math.min(400, card.maxHeight)).toBeLessThanOrEqual(height - 12)
    }
  })
  it('considera el desplazamiento del viewport visual al abrir el teclado móvil', () => {
    const card = placeTourCard({ left: 0, right: 320, top: 700, bottom: 750 }, 320, 250, 400, { left: 0, top: 180 })
    expect(card.top).toBeGreaterThanOrEqual(192)
    expect(card.top + card.maxHeight).toBeLessThanOrEqual(418)
  })
})
