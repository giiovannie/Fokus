import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProfile, updateProfile, uploadProfileAvatar } from './profiles.service.js'
import { clearSession, saveSession } from '../utils/authSession.js'

describe('services de perfil', () => {
  afterEach(() => { clearSession(); vi.unstubAllGlobals() })

  it('sube el campo avatar con POST, Bearer y sin Content-Type manual', async () => {
    saveSession({ user: { id: 1 }, token: 'test-only' })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 2, avatar_url: 'https://example.com/new.webp' }) })
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['image'], 'avatar.png', { type: 'image/png' })
    await uploadProfileAvatar(2, file)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toEqual(expect.stringContaining('/profiles/2/avatar'))
    expect(options.method).toBe('POST')
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('avatar')).toBe(file)
    expect([...options.body.keys()]).toEqual(['avatar'])
    expect(options.headers.Authorization).toBe('Bearer test-only')
    expect(options.headers).not.toHaveProperty('Content-Type')
  })

  it.each([
    ['', null],
    ['   \t\n', null],
    [null, null],
    ['https://example.com/avatar.png', 'https://example.com/avatar.png'],
  ])('envía avatar %j como %j en POST y PUT sin alterar el perfil', async (avatar, expected) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ id: 1 }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const profile = Object.freeze({
      user_id: 1, name: 'Ana', last_name: 'Pérez', nickname: '', avatar_url: avatar,
    })

    await createProfile(profile)
    await updateProfile(2, profile)

    for (const [index, [path, method]] of [['/profiles', 'POST'], ['/profiles/2', 'PUT']].entries()) {
      const [url, options] = fetchMock.mock.calls[index]
      expect(url).toEqual(expect.stringContaining(path))
      expect(options.method).toBe(method)
      expect(JSON.parse(options.body)).toEqual({ ...profile, avatar_url: expected })
    }
    expect(profile.avatar_url).toBe(avatar)
  })

  it('conserva la omisión del avatar en una actualización parcial', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ id: 2 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await updateProfile(2, { nickname: 'Ana' })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ nickname: 'Ana' })
  })
})
