import request from 'supertest'
import { expect, it, vi } from 'vitest'
import { app } from '../src/app.js'
import { Profile } from '../src/models/index.js'

vi.mock('../src/helpers/token.js', () => ({ verifyToken: () => ({ sub: 1 }), generateToken: vi.fn() }))

it('bloquea la solicitud 31 antes de consultar perfiles o procesar archivos', async () => {
  const findProfile = vi.spyOn(Profile, 'findOne')
  for (let i = 0; i < 30; i++) {
    expect((await request(app).post('/api/profiles/invalid/avatar').set('Authorization', 'Bearer test-only')).status).toBe(400)
  }
  const response = await request(app).post('/api/profiles/invalid/avatar').set('Authorization', 'Bearer test-only')
  expect(response.status).toBe(429)
  expect(response.headers['retry-after']).toBeDefined()
  expect(findProfile).not.toHaveBeenCalled()
  findProfile.mockRestore()
})
