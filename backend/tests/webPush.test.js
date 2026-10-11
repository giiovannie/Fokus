import { createHash, createECDH, randomBytes, randomUUID } from 'node:crypto'
import request from 'supertest'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import webPush from 'web-push'
import { app } from '../src/app.js'
import { PushSubscription, NotificationPreference, NotificationPhrase, User, sequelize } from '../src/models/index.js'
import { getPushConfiguration, validatePushSubscription } from '../src/config/webPush.js'
import { notificationDefaults } from '../src/config/notificationPreferences.js'
vi.mock('../src/helpers/token.js', () => ({ verifyToken: token => { if (!['7', '8'].includes(token)) throw new Error(); return { sub: Number(token) } } }))
const vapid = webPush.generateVAPIDKeys()
const curve = createECDH('prime256v1'); curve.generateKeys()
const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/test-only', keys: { p256dh: curve.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } }
const device_id = randomUUID()
const body = { device_id, subscription }
const preview = { event_type: 'exam', style: 'formal', unfiltered_consent: false }
const auth = (req, id = 7) => req.set('Authorization', 'Bearer ' + id)
const matches = (row, where) => Object.entries(where).every(([key, value]) => String(row[key]) === String(value))
let rows, nextId
const register = (input = body, user = 7) => auth(request(app).post('/api/notifications/push/subscriptions'), user).send(input)
const send = (id = 1, input = preview, user = 7) => auth(request(app).post('/api/notifications/push/test/' + id), user).send(input)
beforeEach(() => {
  rows = []; nextId = 1
  vi.stubEnv('VAPID_PUBLIC_KEY', vapid.publicKey); vi.stubEnv('VAPID_PRIVATE_KEY', vapid.privateKey); vi.stubEnv('VAPID_SUBJECT', 'mailto:push@example.test')
  vi.spyOn(sequelize, 'transaction').mockImplementation(fn => fn({ LOCK: { UPDATE: 'UPDATE' } }))
  vi.spyOn(User, 'findByPk').mockResolvedValue({ id: 7 })
  vi.spyOn(PushSubscription, 'findOne').mockImplementation(async ({ where }) => rows.find(row => matches(row, where)) || null)
  vi.spyOn(PushSubscription, 'findAll').mockImplementation(async ({ where }) => rows.filter(row => matches(row, where)))
  vi.spyOn(PushSubscription, 'count').mockImplementation(async ({ where }) => rows.filter(row => matches(row, where)).length)
  vi.spyOn(PushSubscription, 'create').mockImplementation(async data => {
    const row = { ...data, id: nextId++, async update(values) { Object.assign(this, values); return this } }
    rows.push(row); return row
  })
  vi.spyOn(PushSubscription, 'destroy').mockImplementation(async ({ where }) => { const before = rows.length; rows = rows.filter(row => !matches(row, where)); return before - rows.length })
  vi.spyOn(NotificationPreference, 'findOne').mockResolvedValue(notificationDefaults)
  vi.spyOn(NotificationPhrase, 'findAll').mockImplementation(async ({ where }) => [{ user_id: 7, event_type: 'exam', content: 'Frase propia' }, { user_id: 8, event_type: 'exam', content: 'Frase ajena' }].filter(row => matches(row, where)))
  vi.spyOn(webPush, 'sendNotification').mockResolvedValue({ statusCode: 201 })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })
describe('VAPID y destinos seguros', () => {
  it('es opcional, requiere las tres variables y valida el par criptográfico', () => {
    expect(getPushConfiguration({})).toBeNull()
    expect(() => getPushConfiguration({ VAPID_PUBLIC_KEY: vapid.publicKey })).toThrow('VAPID')
    expect(() => getPushConfiguration({ VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: webPush.generateVAPIDKeys().privateKey, VAPID_SUBJECT: 'mailto:push@example.test' })).toThrow('VAPID')
    expect(() => getPushConfiguration({ VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: 'https://localhost' })).toThrow('VAPID')
    expect(getPushConfiguration(process.env).publicKey).toBe(vapid.publicKey)
  })
  it.each(['http://fcm.googleapis.com/send/1', 'https://127.0.0.1/send/1', 'https://fcm.googleapis.com.evil.test/1', 'https://user:secret@fcm.googleapis.com/1', 'https://fcm.googleapis.com:8443/1', 'https://evil.test/1'])('rechaza SSRF y proveedores ajenos: %s', endpoint => {
    expect(validatePushSubscription({ ...subscription, endpoint })).toBe(false)
  })
  it.each(['https://updates.push.services.mozilla.com/wpush/v2/test', 'https://web.push.apple.com/test', 'https://wns2.notify.windows.com/test'])('admite proveedores conocidos: %s', endpoint => {
    expect(validatePushSubscription({ ...subscription, endpoint })).toBe(true)
  })
})
describe('Web Push autenticado y aislado', () => {
  it('requiere JWT en configuración, registro, listado, eliminación y envío', async () => {
    for (const req of [request(app).get('/api/notifications/push/config'), request(app).get('/api/notifications/push/subscriptions'), request(app).post('/api/notifications/push/subscriptions'), request(app).delete('/api/notifications/push/subscriptions/1'), request(app).post('/api/notifications/push/test/1')]) expect((await req).status).toBe(401)
  })
  it('publica solamente la clave pública y mantiene disponible la API sin VAPID', async () => {
    expect((await auth(request(app).get('/api/notifications/push/config'))).body).toEqual({ enabled: true, public_key: vapid.publicKey })
    vi.stubEnv('VAPID_PUBLIC_KEY', ''); vi.stubEnv('VAPID_PRIVATE_KEY', ''); vi.stubEnv('VAPID_SUBJECT', '')
    expect((await auth(request(app).get('/api/notifications/push/config'))).body).toEqual({ enabled: false, public_key: null })
    expect((await register()).status).toBe(503)
    expect(PushSubscription.create).not.toHaveBeenCalled()
  })
  it('registra idempotentemente por dispositivo sin exponer endpoints ni claves', async () => {
    const result = await register()
    expect(result.status).toBe(200); expect(result.body).toEqual({ id: 1, device_id, device_label: 'Este navegador' })
    expect((await register()).body.id).toBe(1)
    expect(rows).toHaveLength(1)
    expect((await auth(request(app).get('/api/notifications/push/subscriptions'), 8)).body).toEqual([])
    expect((await auth(request(app).get('/api/notifications/push/subscriptions'))).body).toEqual([result.body])
    expect((await register(body, 8)).status).toBe(409)
    expect((await register({ ...body, device_id: randomUUID() })).status).toBe(409)
  })
  it('rechaza suscripciones, claves, identificadores y campos inesperados antes de escribir', async () => {
    const inputs = [{ ...body, user_id: 8 }, { ...body, device_id: 'incorrecto' }, { ...body, subscription: { ...subscription, endpoint: 'https://localhost/test' } }, { ...body, subscription: { ...subscription, keys: { ...subscription.keys, auth: 'bad' } } }, { ...body, subscription: { ...subscription, keys: { ...subscription.keys, p256dh: Buffer.alloc(65, 4).toString('base64url') } } }, { ...body, device_label: 'hola\nchau' }]
    for (const input of inputs) expect((await register(input)).status).toBe(400)
    expect(PushSubscription.create).not.toHaveBeenCalled()
  })
  it('permite renovar y limita diez dispositivos propios', async () => {
    for (let i = 0; i < 10; i++) expect((await register({ device_id: randomUUID(), subscription: { ...subscription, endpoint: subscription.endpoint + i } })).status).toBe(200)
    expect((await register()).status).toBe(409)
    const first = rows[0]
    expect((await register({ device_id: first.device_id, subscription: { ...subscription, endpoint: subscription.endpoint + '-renewed' } })).status).toBe(200)
    expect(rows).toHaveLength(10)
    expect((await register(body, 8)).status).toBe(200)
  })
  it('impide eliminar y enviar a otro estudiante, incluso con su ID conocido', async () => {
    await register()
    expect((await auth(request(app).delete('/api/notifications/push/subscriptions/1'), 8)).status).toBe(404)
    expect((await send(1, preview, 8)).status).toBe(404)
    expect(webPush.sendNotification).not.toHaveBeenCalled()
    expect((await auth(request(app).delete('/api/notifications/push/subscriptions/1'))).status).toBe(204)
    expect(rows).toHaveLength(0)
  })
  it('envía la vista previa elegida y genera obligatoriamente los datos del evento', async () => {
    await register()
    const result = await send(1, { ...preview, style: 'custom', selected_phrase: 'Frase propia' })
    expect(result.status).toBe(202)
    const [destination, json, options] = webPush.sendNotification.mock.calls[0]
    expect(destination).toEqual(subscription)
    const message = JSON.parse(json)
    expect(message.body).toContain('[PRUEBA] Frase propia')
    expect(message.body).toContain('Matemática (ejemplo)')
    expect(message.body).toContain('09:00')
    expect(message.body).not.toContain('Frase ajena')
    expect(message.data).toEqual({ source: 'fokus', test: true })
    expect(options.vapidDetails.publicKey).toBe(vapid.publicKey)
    expect(options.TTL).toBe(60)
    expect(NotificationPreference.findOne).toHaveBeenCalledWith({ where: { user_id: 7 } })
  })
  it('no acepta frases ajenas, cuerpo arbitrario ni sin filtro sin consentimiento', async () => {
    await register()
    expect((await send(1, { ...preview, style: 'custom', selected_phrase: 'Frase ajena' })).status).toBe(400)
    expect((await send(1, { ...preview, body: 'Suplantación' })).status).toBe(400)
    expect((await send(1, { ...preview, style: 'unfiltered' })).status).toBe(400)
    expect(webPush.sendNotification).not.toHaveBeenCalled()
    expect((await send(1, { ...preview, style: 'unfiltered', unfiltered_consent: true })).status).toBe(202)
  })
  it.each([404, 410])('elimina solamente la suscripción vencida ante respuesta %s', async statusCode => {
    await register()
    webPush.sendNotification.mockRejectedValue({ statusCode, body: 'secret', endpoint: subscription.endpoint })
    const result = await send()
    expect(result.status).toBe(410); expect(JSON.stringify(result.body)).not.toContain('secret')
    expect(rows).toHaveLength(0)
    expect(PushSubscription.destroy).toHaveBeenCalledWith({ where: { id: 1, user_id: 7, endpoint_hash: createHash('sha256').update(subscription.endpoint).digest('hex') } })
  })
  it('no elimina una suscripción renovada mientras vencía el envío anterior', async () => {
    await register()
    webPush.sendNotification.mockImplementation(async () => {
      rows[0].endpoint_hash = 'renewed-endpoint-hash'
      throw { statusCode: 410 }
    })
    expect((await send()).status).toBe(410)
    expect(rows).toHaveLength(1)
    expect(rows[0].endpoint_hash).toBe('renewed-endpoint-hash')
  })
  it.each([403, 429, 500, undefined])('conserva suscripción ante fallos transitorios y oculta detalles %s', async statusCode => {
    await register(); webPush.sendNotification.mockRejectedValue({ statusCode, body: 'secret', message: subscription.endpoint })
    const result = await send()
    expect(result.status).toBe(503); expect(JSON.stringify(result.body)).not.toContain('secret')
    expect(JSON.stringify(result.body)).not.toContain(subscription.endpoint)
    expect(rows).toHaveLength(1)
  })
})
