import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
const source = readFileSync('public/sw.js', 'utf8')
const click = async (windows, test = true) => {
  const handlers = {}
  const clients = { matchAll: vi.fn().mockResolvedValue(windows), openWindow: vi.fn() }
  runInNewContext(source, { self: { addEventListener: (name, handler) => { handlers[name] = handler }, clients, location: { origin: 'https://fokus.example.test' } }, URL })
  let pending
  const event = { notification: { data: { test }, close: vi.fn() }, waitUntil: promise => { pending = promise } }
  handlers.notificationclick(event)
  await pending
  return { clients, event, handlers }
}
describe('interacción con notificaciones de prueba', () => {
  it('enfoca Fokus y abre preferencias sin registrar Push', async () => {
    const window = { url: 'https://fokus.example.test/notifications', focus: vi.fn(), navigate: vi.fn() }
    const { clients, event, handlers } = await click([window])
    expect(window.focus).toHaveBeenCalledOnce()
    expect(window.navigate).toHaveBeenCalledWith('/notifications/preferences')
    expect(event.notification.close).toHaveBeenCalledOnce()
    expect(clients.openWindow).not.toHaveBeenCalled()
    expect(handlers.push).toBeTypeOf('function')
  })
  it('abre preferencias cuando no existe ventana de Fokus y omite avisos ajenos', async () => {
    const result = await click([])
    expect(result.clients.openWindow).toHaveBeenCalledWith('/notifications/preferences')
    const unrelated = await click([], false)
    expect(unrelated.clients.matchAll).not.toHaveBeenCalled()
    expect(unrelated.event.notification.close).not.toHaveBeenCalled()
  })
})

describe('recepción remota con Fokus sin ventanas abiertas', () => {
  const receive = async data => {
    const handlers = {}, registration = { showNotification: vi.fn().mockResolvedValue(undefined) }
    runInNewContext(source, { self: { addEventListener: (name, handler) => { handlers[name] = handler }, registration }, URL })
    let pending
    handlers.push({ data, waitUntil: value => { pending = value } }); await pending
    return registration.showNotification
  }
  it('muestra el mensaje de Express con ícono, marca de prueba y tag de deduplicación', async () => {
    const show = await receive({ json: () => ({ title: 'Fokus · Prueba', body: '[PRUEBA] Mi frase\nMateria: Matemática.', id: 'abc-123', data: { test: true, url: 'https://evil.test' } }) })
    expect(show).toHaveBeenCalledWith('Fokus · Prueba', { body: '[PRUEBA] Mi frase\nMateria: Matemática.', icon: '/icons/fokus-192.png', badge: '/icons/fokus-192.png', tag: 'fokus-push-abc-123', data: { source: 'fokus', test: true } })
  })
  it('muestra un aviso seguro cuando no hay datos o el JSON es inválido', async () => {
    for (const data of [null, { json: () => { throw new Error('Inválido') } }, { json: () => ({ title: 3, body: {} }) }]) {
      const show = await receive(data)
      expect(show).toHaveBeenCalledWith('Fokus', expect.objectContaining({ body: expect.stringContaining('Recibiste una notificación') }))
    }
  })
})
