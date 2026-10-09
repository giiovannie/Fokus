import express from 'express'
import request from 'supertest'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

it('configura el origen HTTPS exacto y confía solo en el salto inmediato configurado', async () => {
  vi.stubEnv('FRONTEND_URL', 'https://frontend.example.test/')
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
