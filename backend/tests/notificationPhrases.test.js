import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from '../src/app.js'
import { NotificationPhrase, NotificationPreference, User, sequelize } from '../src/models/index.js'
import { notificationDefaults } from '../src/config/notificationPreferences.js'
vi.mock('../src/helpers/token.js', () => ({ verifyToken: token => { if (!['7', '8'].includes(token)) throw new Error(); return { sub: Number(token) } } }))
const auth = (req, id = 7) => req.set('Authorization', 'Bearer ' + id)
let phrases, preference, nextId
const transaction = { LOCK: { UPDATE: 'UPDATE' } }
const post = (content = 'Mi frase', event_type = 'exam', id = 7) => auth(request(app).post('/api/notifications/phrases'), id).send({ content, event_type })
beforeEach(() => {
  phrases = []; nextId = 1
  preference = { ...notificationDefaults, revision: 1, async increment() { this.revision++ }, async update(values) { Object.assign(this, values); return this } }
  vi.spyOn(sequelize, 'transaction').mockImplementation(fn => fn(transaction))
  vi.spyOn(User, 'findByPk').mockImplementation(async id => ({ id }))
  vi.spyOn(NotificationPreference, 'findOrCreate').mockResolvedValue([preference])
  vi.spyOn(NotificationPreference, 'findOne').mockResolvedValue(preference)
  vi.spyOn(NotificationPhrase, 'findAll').mockImplementation(async ({ where }) => phrases.filter(row => row.user_id === where.user_id && (!where.event_type || row.event_type === where.event_type)))
  vi.spyOn(NotificationPhrase, 'findOne').mockImplementation(async ({ where }) => phrases.find(row => row.user_id === where.user_id && (!where.id || row.id === Number(where.id)) && (!where.event_type || row.event_type === where.event_type)) || null)
  vi.spyOn(NotificationPhrase, 'create').mockImplementation(async data => {
    const row = { ...data, id: nextId++, async update(values) { Object.assign(this, values); return this }, async destroy() { phrases = phrases.filter(item => item.id !== this.id) } }
    phrases.push(row); return row
  })
})
afterEach(() => vi.restoreAllMocks())
describe('frases propias autenticadas', () => {
  it('requiere JWT en todas las operaciones', async () => {
    for (const req of [request(app).get('/api/notifications/phrases'), request(app).post('/api/notifications/phrases'), request(app).put('/api/notifications/phrases/1'), request(app).delete('/api/notifications/phrases/1')]) expect((await req).status).toBe(401)
  })
  it('guarda, consulta, edita y elimina solamente frases propias', async () => {
    const result = await post('  Dejá de boludear y estudiá.  ')
    expect(result.status).toBe(201)
    expect(result.body).toEqual({ id: 1, event_type: 'exam', content: 'Dejá de boludear y estudiá.' })
    await post('Otra frase', 'task', 8)
    expect((await auth(request(app).get('/api/notifications/phrases'))).body).toHaveLength(1)
    expect((await auth(request(app).get('/api/notifications/phrases?event_type=task'))).body).toEqual([])
    expect((await auth(request(app).put('/api/notifications/phrases/1'), 8).send({ content: 'Ajena', event_type: 'exam' })).status).toBe(404)
    expect((await auth(request(app).delete('/api/notifications/phrases/1'), 8)).status).toBe(404)
    const edit = await auth(request(app).put('/api/notifications/phrases/1')).send({ content: 'Repasá', event_type: 'task' })
    expect(edit.status).toBe(200); expect(edit.body.event_type).toBe('task')
    expect((await auth(request(app).delete('/api/notifications/phrases/1'))).status).toBe(204)
    expect((await auth(request(app).get('/api/notifications/phrases'))).body).toEqual([])
    expect(preference.revision).toBe(5)
    expect(User.findByPk).toHaveBeenCalledWith(7, { transaction, lock: 'UPDATE' })
  })
  it.each(['', '   ', 'a'.repeat(241), 'hola\nchau', 'hola\u0000', 'hola\u202e'])('rechaza contenido inválido %j', async content => {
    expect((await post(content)).status).toBe(400)
    expect(NotificationPhrase.create).not.toHaveBeenCalled()
  })
  it('rechaza suplantación de usuario y tipo inválido', async () => {
    expect((await auth(request(app).post('/api/notifications/phrases')).send({ content: 'Hola', event_type: 'exam', user_id: 8 })).status).toBe(400)
    expect((await post('Hola', 'unknown')).status).toBe(400)
  })
  it('limita diez en total, permite editar al alcanzar el límite y evita duplicados', async () => {
    for (let i = 0; i < 10; i++) expect((await post('Frase ' + i, i % 2 ? 'task' : 'exam')).status).toBe(201)
    expect((await post('Frase extra')).status).toBe(409)
    expect((await auth(request(app).put('/api/notifications/phrases/1')).send({ content: 'Editada', event_type: 'exam' })).status).toBe(200)
    expect((await auth(request(app).put('/api/notifications/phrases/1')).send({ content: 'Frase 2', event_type: 'exam' })).status).toBe(409)
    expect((await post('Frase extra', 'exam', 8)).status).toBe(201)
  })
  it('exige una frase para seleccionar custom y protege la última frase del estilo guardado', async () => {
    const values = { ...notificationDefaults, exam_style: 'custom' }
    expect((await auth(request(app).put('/api/notifications/preferences')).send(values)).status).toBe(400)
    await post()
    expect((await auth(request(app).put('/api/notifications/preferences')).send(values)).status).toBe(200)
    expect((await auth(request(app).delete('/api/notifications/phrases/1'))).status).toBe(409)
    expect((await auth(request(app).put('/api/notifications/phrases/1')).send({ content: 'Frase', event_type: 'task' })).status).toBe(409)
    expect((await auth(request(app).put('/api/notifications/preferences')).send(notificationDefaults)).status).toBe(200)
    expect((await auth(request(app).delete('/api/notifications/phrases/1'))).status).toBe(204)
  })
  it('la vista previa usa frases del JWT sin escrituras ni otros usuarios', async () => {
    await post('Frase propia'); await post('Frase ajena', 'exam', 8)
    NotificationPhrase.create.mockClear()
    const result = await auth(request(app).post('/api/notifications/preview')).send({ event_type: 'exam', style: 'custom', unfiltered_consent: false })
    expect(result.status).toBe(200)
    expect(result.body.body).toContain('[PRUEBA] Frase propia')
    expect(result.body.body).not.toContain('Frase ajena')
    expect(result.body.body).toContain('Matemática (ejemplo)')
    expect(result.body.body).toContain('09:00')
    expect(NotificationPhrase.create).not.toHaveBeenCalled()
    expect(NotificationPhrase.findAll).toHaveBeenLastCalledWith({ where: { user_id: 7, event_type: 'exam' } })
    expect((await request(app).post('/api/notifications/preview')).status).toBe(401)
  })
  it('la prueba no modifica preferencias y exige consentimiento sin filtro explícito', async () => {
    const req = consent => auth(request(app).post('/api/notifications/preview')).send({ event_type: 'task', style: 'unfiltered', unfiltered_consent: consent })
    expect((await req(false)).status).toBe(400)
    expect((await req(true)).status).toBe(200)
    expect(preference.unfiltered_enabled).toBe(false)
    expect(preference.revision).toBe(1)
    expect(sequelize.transaction).not.toHaveBeenCalled()
  })
  it('rechaza la prueba custom sin frases propias de ese tipo', async () => {
    await post('Ajena', 'task', 8)
    expect((await auth(request(app).post('/api/notifications/preview')).send({ event_type: 'task', style: 'custom', unfiltered_consent: false })).status).toBe(400)
  })

})
