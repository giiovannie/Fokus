import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProfile, updateProfile } from './profiles.service.js'

describe('services de perfil', () => {
  afterEach(() => vi.unstubAllGlobals())

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
