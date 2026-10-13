import request from 'supertest'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { app } from '../src/app.js'
import { User, Profile, sequelize } from '../src/models/index.js'
vi.mock('../src/helpers/token.js', () => ({ verifyToken: token => { if (!['7', '8', '9'].includes(token)) throw new Error(); return { sub: Number(token) } } }))
let profiles
const get = (id = 7) => request(app).get('/api/profiles/onboarding').set('Authorization', 'Bearer ' + id)
const put = (values, id = 7) => request(app).put('/api/profiles/onboarding').set('Authorization', 'Bearer ' + id).send(values)
beforeEach(() => {
  profiles = new Map([7, 8].map(id => [id, { id, user_id: id, preferences: { other: 'preservar' }, update: vi.fn(async function (values) { Object.assign(this, values) }) }]))
  vi.spyOn(User, 'findByPk').mockImplementation(async id => ({ id: Number(id), status: 'active', role: Number(id) === 9 ? 'superadmin' : 'student' }))
  vi.spyOn(Profile, 'findOne').mockImplementation(async ({ where }) => profiles.get(where.user_id) || null)
  vi.spyOn(sequelize, 'transaction').mockImplementation(action => action({ LOCK: { UPDATE: 'UPDATE' } }))
})
afterEach(() => vi.restoreAllMocks())
describe('progreso del recorrido por cuenta', () => {
  it('requiere autenticación y excluye al superadministrador', async () => {
    expect((await request(app).get('/api/profiles/onboarding')).status).toBe(401)
    expect((await get(9)).status).toBe(403)
    expect((await put({ step: 0, status: 'paused', revision: 0 }, 9)).status).toBe(403)
  })
  it('lee defaults sin escribir ni crear perfiles ficticios', async () => {
    expect((await get()).body).toEqual({ version: 1, status: 'not_started', step: 0, revision: 0 })
    expect(profiles.get(7).update).not.toHaveBeenCalled()
    profiles.delete(7); expect((await get()).status).toBe(404)
    expect((await put({ step: 0, status: 'paused', revision: 0 })).status).toBe(404)
  })
  it('persiste, retoma en otra lectura y conserva las otras preferencias', async () => {
    const saved = await put({ status: 'in_progress', step: 4, revision: 0 })
    expect(saved.status).toBe(200); expect(saved.body).toEqual({ version: 1, status: 'in_progress', step: 4, revision: 1 })
    expect((await get()).body).toEqual(saved.body)
    expect(profiles.get(7).preferences.other).toBe('preservar')
    expect((await get(8)).body.status).toBe('not_started')
    expect(profiles.get(8).update).not.toHaveBeenCalled()
  })
  it('rechaza revisión obsoleta sin sobreescribir otro dispositivo', async () => {
    await put({ status: 'paused', step: 2, revision: 0 })
    expect((await put({ status: 'completed', step: 7, revision: 0 })).status).toBe(409)
    expect((await get()).body).toMatchObject({ status: 'paused', step: 2, revision: 1 })
  })
  it.each(['skipped', 'completed'])('conserva %s y admite un reinicio voluntario', async status => {
    await put({ status, step: 7, revision: 0 })
    expect((await get()).body.status).toBe(status)
    expect((await put({ status: 'in_progress', step: 0, revision: 1 })).body).toMatchObject({ status: 'in_progress', step: 0, revision: 2 })
  })
  it.each([
    { status: 'paused', step: 8, revision: 0 }, { status: 'paused', step: -1, revision: 0 },
    { status: 'paused', step: '0', revision: 0 }, { status: 'paused', step: 0, revision: '0' },
    { status: 'completed', step: 2, revision: 0 }, { status: 'inventado', step: 0, revision: 0 },
    { status: 'paused', step: 0, revision: 0, user_id: 8 },
  ])('rechaza datos inválidos y la selección de otra cuenta: %j', async body => {
    expect((await put(body)).status).toBe(400)
    expect(profiles.get(7).update).not.toHaveBeenCalled()
  })
})
