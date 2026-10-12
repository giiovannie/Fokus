import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearSession, getSession, saveSession } from '../utils/authSession.js'
import { ApiError, apiRequest } from './api.js'

describe('apiRequest', () => {
  afterEach(() => {
    clearSession()
    vi.unstubAllGlobals()
  })

  it('devuelve el JSON de una respuesta correcta', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([{ id: 1, name: 'Programación' }]),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/subjects')).resolves.toEqual([{ id: 1, name: 'Programación' }])
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/subjects'), expect.objectContaining({
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    }))
  })

  it('convierte respuestas fallidas en ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ message: 'Credenciales incorrectas' }),
    }))

    await expect(apiRequest('/auth/login')).rejects.toEqual(expect.objectContaining({
      name: 'ApiError', message: 'Credenciales incorrectas', status: 401,
    }))
    expect(new ApiError('Error', 500)).toBeInstanceOf(Error)
  })

  it('adjunta el token de acceso cuando existe una sesión', async () => {
    saveSession({ user: { id: 1, email: 'user@example.com' }, token: 'jwt-token' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    })
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/tasks')

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/tasks'), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer jwt-token' }),
    }))
  })
})

it('limpia una sesión inválida en una petición protegida', async () => {
  saveSession({ user: { id: 1 }, token: 'expired' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Token inválido' }) }))
  await expect(apiRequest('/subjects')).rejects.toThrow('Tu sesión expiró. Iniciá sesión nuevamente.')
  expect(getSession()).toBeNull()
  vi.unstubAllGlobals()
})

it.each([403, 500])('no cierra la sesión por HTTP %s', async status => {
  saveSession({ user: { id: 1 }, token: 'valid' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({ message: 'Error' }) }))
  await expect(apiRequest('/tasks')).rejects.toBeInstanceOf(ApiError)
  expect(getSession()?.token).toBe('valid')
  clearSession(); vi.unstubAllGlobals()
})

it('un 401 tardío no cierra una nueva sesión', async () => {
  saveSession({ user: { id: 1 }, token: 'old' })
  let resolve
  vi.stubGlobal('fetch', vi.fn(() => new Promise(done => { resolve = done })))
  const request = apiRequest('/subjects')
  saveSession({ user: { id: 2 }, token: 'new' })
  resolve({ ok: false, status: 401, json: async () => ({ message: 'Token inválido' }) })
  await expect(request).rejects.toBeInstanceOf(ApiError)
  expect(getSession()?.token).toBe('new')
  clearSession(); vi.unstubAllGlobals()
})

it('las credenciales incorrectas no invalidan una sesión existente', async () => {
  saveSession({ user: { id: 1 }, token: 'valid' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Credenciales incorrectas' }) }))
  await expect(apiRequest('/auth/login')).rejects.toThrow('Credenciales incorrectas')
  expect(getSession()?.token).toBe('valid')
  clearSession(); vi.unstubAllGlobals()
})
