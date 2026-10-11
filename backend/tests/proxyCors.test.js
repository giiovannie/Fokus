import express from 'express'
import request from 'supertest'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

it('configura el origen HTTPS exacto y confía solo en el salto inmediato configurado', async () => {
  vi.stubEnv('FRONTEND_URL', 'https://frontend.example.test/')
  vi.stubEnv('CORS_ADDITIONAL_ORIGINS', '')
  vi.stubEnv('TRUST_PROXY_HOPS', '1')
  const { app } = await import('../src/app.js')
  expect(app.get('trust proxy')).toBe(1)
  const response = await request(app).get('/api/health').set('Origin', 'https://frontend.example.test')
  expect(response.status).toBe(200)
  expect(response.headers['access-control-allow-origin']).toBe('https://frontend.example.test')
  expect((await request(app).get('/api/health').set('Origin', 'https://frontend.example.test.evil.test')).status).toBe(403)
  // Usar la misma función de confianza de la aplicación sin publicar una ruta
  // de diagnóstico que revele direcciones de clientes.
  const probe = express()
  probe.set('trust proxy', app.get('trust proxy'))
  probe.get('/', (req, res) => res.json({ ip: req.ip }))
  const forwarded = await request(probe).get('/').set('X-Forwarded-For', '198.51.100.99, 203.0.113.10')
  expect(forwarded.body.ip).toBe('203.0.113.10')
})

it.each(['https://fokus-app.onrender.com', 'https://localhost'])('permite preflight y solicitudes desde %s', async (origin) => {
  vi.stubEnv('FRONTEND_URL', 'https://fokus-app.onrender.com')
  vi.stubEnv('CORS_ADDITIONAL_ORIGINS', 'https://localhost')
  const { app } = await import('../src/app.js')
  const response = await request(app).options('/api/auth/login')
    .set('Origin', origin).set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type,authorization')
  expect(response.status).toBe(204)
  expect(response.headers['access-control-allow-origin']).toBe(origin)
  expect(response.headers['access-control-allow-methods']).toBe('GET,POST,PUT,PATCH,DELETE')
  expect(response.headers['access-control-allow-headers']).toBe('Content-Type,Authorization')
  expect(response.headers.vary).toContain('Origin')
  const health = await request(app).get('/api/health').set('Origin', origin)
  expect(health.status).toBe(200)
  expect(health.headers['access-control-allow-origin']).toBe(origin)
})

it.each(['https://localhost.evil.test', 'http://localhost', 'https://localhost:444', 'null'])('rechaza el origen no autorizado %s', async (origin) => {
  vi.stubEnv('FRONTEND_URL', 'https://fokus-app.onrender.com')
  vi.stubEnv('CORS_ADDITIONAL_ORIGINS', 'https://localhost')
  const { app } = await import('../src/app.js')
  for (const method of ['get', 'options']) {
    const response = await request(app)[method]('/api/health').set('Origin', origin)
    expect(response.status).toBe(403)
    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  }
})

it('conserva desarrollo y healthchecks sin Origin sin habilitar Android implícitamente', async () => {
  vi.stubEnv('FRONTEND_URL', '')
  vi.stubEnv('CORS_ADDITIONAL_ORIGINS', '')
  const { app } = await import('../src/app.js')
  expect((await request(app).get('/api/health').set('Origin', 'http://localhost:5173')).status).toBe(200)
  expect((await request(app).get('/api/health').set('Origin', 'https://localhost')).status).toBe(403)
  const health = await request(app).get('/api/health')
  expect(health.status).toBe(200)
  expect(health.headers['access-control-allow-origin']).toBeUndefined()
})
