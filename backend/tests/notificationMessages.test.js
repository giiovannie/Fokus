import { describe, expect, it } from 'vitest'
import { buildNotificationMessage, notificationTemplates } from '../src/utils/notificationMessages.js'
const event = { title: 'Parcial', subject: 'Matemática', date: '2026-10-12', time: '09:00', timezone: 'America/Argentina/Cordoba' }
describe('mensajes y plantillas', () => {
  it.each(['exam', 'task'])('mantiene varias plantillas de cada personalidad para %s y agrega datos de Fokus', eventType => {
    for (const style of Object.keys(notificationTemplates[eventType])) {
      expect(notificationTemplates[eventType][style].length).toBeGreaterThan(1)
      const first = buildNotificationMessage({ eventType, style, event, unfilteredEnabled: true, random: () => 0 })
      const next = buildNotificationMessage({ eventType, style, event, unfilteredEnabled: true, random: () => 0, previousText: first.phrase })
      expect(next.phrase).not.toBe(first.phrase)
      expect(first.body).toContain('Matemática'); expect(first.body).toContain('12/10/2026'); expect(first.body).toContain('09:00')
    }
  })
  it('separa frases por evento y no deja que sustituyan datos generados', () => {
    const phrases = [{ event_type: 'exam', content: 'Mi examen' }, { event_type: 'task', content: 'Mi entrega' }]
    const message = buildNotificationMessage({ eventType: 'exam', style: 'custom', event, phrases, test: true })
    expect(message.body).toContain('[PRUEBA] Mi examen'); expect(message.body).not.toContain('Mi entrega')
    expect(message.body).toContain('Fecha: 12/10/2026'); expect(message.title).toContain('prueba')
    expect(() => buildNotificationMessage({ eventType: 'exam', style: 'custom', event })).toThrow('Agregá')
  })
  it('no usa sin filtro sin consentimiento', () => {
    expect(() => buildNotificationMessage({ eventType: 'exam', style: 'unfiltered', event })).toThrow('explícitamente')
  })
})
