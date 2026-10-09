import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { app } from '../src/app.js'

afterEach(() => { app.locals.shuttingDown = false; app.set('trust proxy', false) })

describe('health y CORS', () => {
  it('devuelve estado público mínimo sin caché ni autenticación', async () => {
    const response = await request(app).get('/api/health')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
    expect(response.headers['cache-control']).toBe('no-store')
  })
  it('devuelve 503 durante el cierre', async () => {
    app.locals.shuttingDown = true
    expect((await request(app).get('/api/health')).status).toBe(503)
  })
  it('permite el origen de desarrollo y Bearer en preflight', async () => {
    const response = await request(app).options('/api/users').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'authorization,content-type')
    expect(response.status).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(response.headers['access-control-allow-headers']).toContain('Authorization')
  })
  it('rechaza dominios distintos antes del controlador', async () => {
    const response = await request(app).post('/api/users').set('Origin', 'https://unexpected.example').send({})
    expect(response.status).toBe(403)
    expect(response.body).toEqual({ message: 'Origen no permitido' })
    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})

describe('límites reales de rutas', () => {
  it('limita login a 20 solicitudes y no permite evadirlo con X-Forwarded-For', async () => {
    for (let i = 0; i < 20; i++) {
      const response = await request(app).post('/api/auth/login').send({})
      expect(response.status).toBe(400)
    }
    const response = await request(app).post('/api/auth/login').set('X-Forwarded-For', '203.0.113.99').send({})
    expect(response.status).toBe(429)
    expect(response.headers['retry-after']).toBeDefined()
    expect(response.body).toEqual({ message: 'Demasiadas solicitudes. Intentá nuevamente más tarde' })
  })
  it('limita registro a 10 solicitudes por hora', async () => {
    for (let i = 0; i < 10; i++) expect((await request(app).post('/api/users').send({})).status).toBe(400)
    expect((await request(app).post('/api/users').send({})).status).toBe(429)
  })
})
