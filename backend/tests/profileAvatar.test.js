import request from 'supertest'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from '../src/app.js'
import { Profile, sequelize } from '../src/models/index.js'
import { deleteAvatar, getOwnedAvatarId, uploadAvatar } from '../src/services/cloudinary.service.js'

vi.mock('../src/helpers/token.js', () => ({ verifyToken: () => ({ sub: 1 }) }))
vi.mock('../src/services/cloudinary.service.js', () => ({
  uploadAvatar: vi.fn(), deleteAvatar: vi.fn(), getOwnedAvatarId: vi.fn(),
}))

const avatarUrl = 'https://res.cloudinary.com/example/image/upload/new.webp'
const imageBuffer = (format = 'png') => sharp({
  create: { width: 2, height: 2, channels: 3, background: '#ffffff' },
}).toFormat(format).toBuffer()

describe('subida de avatar del perfil', () => {
  let profile
  beforeEach(() => {
    vi.resetAllMocks()
    profile = {
      id: 2, user_id: 1, name: 'Ana', last_name: 'Pérez', nickname: '', avatar_url: null,
      update: vi.fn(async (changes) => Object.assign(profile, changes)),
    }
    vi.spyOn(Profile, 'findOne').mockResolvedValue(profile)
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }))
    uploadAvatar.mockResolvedValue({ publicId: 'new-image', url: avatarUrl })
    deleteAvatar.mockResolvedValue(undefined)
    getOwnedAvatarId.mockReturnValue(null)
  })
  afterEach(() => vi.restoreAllMocks())

  const sendAvatar = (buffer, options = { filename: 'avatar.png', contentType: 'image/png' }) => request(app)
    .post('/api/profiles/2/avatar').set('Authorization', 'Bearer test-only').attach('avatar', buffer, options)

  it.each(['jpeg', 'png', 'webp'])('acepta contenido %s real y devuelve el perfil sin cambiar otros campos', async (format) => {
    const response = await sendAvatar(await imageBuffer(format), { filename: 'photo.bin', contentType: 'application/octet-stream' })
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ id: 2, user_id: 1, name: 'Ana', last_name: 'Pérez', nickname: '', avatar_url: avatarUrl })
    expect((await sharp(uploadAvatar.mock.calls[0][0]).metadata()).format).toBe('webp')
    expect(profile.update).toHaveBeenCalledWith({ avatar_url: avatarUrl }, { transaction: expect.any(Object) })
  })

  it.each([
    ['SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>')],
    ['contenido falso', Buffer.from('not an image')],
    ['PNG truncado', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
  ])('rechaza %s aunque el cliente declare PNG', async (_, buffer) => {
    expect((await sendAvatar(buffer)).status).toBe(400)
    expect(uploadAvatar).not.toHaveBeenCalled()
    expect(profile.update).not.toHaveBeenCalled()
  })

  it('rechaza archivos mayores de 5 MB antes de subirlos', async () => {
    expect((await sendAvatar(Buffer.alloc(5 * 1024 * 1024 + 1))).status).toBe(413)
    expect(uploadAvatar).not.toHaveBeenCalled()
  })

  it('rechaza GIF aunque sea una imagen real', async () => {
    expect((await sendAvatar(await imageBuffer('gif'))).status).toBe(400)
    expect(uploadAvatar).not.toHaveBeenCalled()
  })

  it('rechaza imágenes con más de 16 megapíxeles aunque pesen menos de 5 MB', async () => {
    const buffer = await sharp({ create: { width: 4097, height: 4097, channels: 3, background: '#fff' } }).png().toBuffer()
    expect(buffer.length).toBeLessThan(5 * 1024 * 1024)
    expect((await sendAvatar(buffer)).status).toBe(400)
    expect(uploadAvatar).not.toHaveBeenCalled()
  })

  it('rechaza un ID inválido antes de consultar el perfil', async () => {
    const response = await request(app).post('/api/profiles/invalid/avatar').set('Authorization', 'Bearer test-only')
    expect(response.status).toBe(400)
    expect(Profile.findOne).not.toHaveBeenCalled()
  })

  it('requiere autenticación antes de consultar o procesar el archivo', async () => {
    const response = await request(app).post('/api/profiles/2/avatar').attach('avatar', await imageBuffer(), 'avatar.png')
    expect(response.status).toBe(401)
    expect(Profile.findOne).not.toHaveBeenCalled()
  })

  it('rechaza un perfil ajeno antes de procesar incluso un archivo inválido', async () => {
    Profile.findOne.mockResolvedValue(null)
    const response = await sendAvatar(Buffer.from('invalid'))
    expect(response.status).toBe(404)
    expect(Profile.findOne).toHaveBeenCalledWith({ where: { id: '2', user_id: 1 } })
    expect(uploadAvatar).not.toHaveBeenCalled()
  })

  it('requiere un archivo y limita la petición a un único avatar', async () => {
    expect((await request(app).post('/api/profiles/2/avatar').set('Authorization', 'Bearer test-only')).status).toBe(400)
    const buffer = await imageBuffer()
    const response = await request(app).post('/api/profiles/2/avatar').set('Authorization', 'Bearer test-only')
      .attach('avatar', buffer, 'a.png').attach('avatar', buffer, 'b.png')
    expect(response.status).toBe(400)
    expect(uploadAvatar).not.toHaveBeenCalled()
  })

  it('no guarda el perfil si falla Cloudinary y no revela detalles del proveedor', async () => {
    uploadAvatar.mockRejectedValue(Object.assign(new Error('No se pudo subir la imagen al almacenamiento'), { status: 502 }))
    const response = await sendAvatar(await imageBuffer())
    expect(response.status).toBe(502)
    expect(profile.update).not.toHaveBeenCalled()
    expect(deleteAvatar).not.toHaveBeenCalled()
  })

  it('elimina la nueva imagen si falla el guardado, conservando la anterior', async () => {
    profile.avatar_url = 'https://example.com/previous.png'
    profile.update.mockRejectedValue(new Error('database failed'))
    const response = await sendAvatar(await imageBuffer())
    expect(response.status).toBe(500)
    expect(response.body).toEqual({ message: 'Ocurrió un error interno' })
    expect(deleteAvatar).toHaveBeenCalledExactlyOnceWith('new-image')
    expect(profile.avatar_url).toBe('https://example.com/previous.png')
  })

  it('elimina la nueva imagen cuando falla la confirmación de la transacción', async () => {
    sequelize.transaction.mockRejectedValue(new Error('transaction failed'))
    expect((await sendAvatar(await imageBuffer())).status).toBe(500)
    expect(deleteAvatar).toHaveBeenCalledExactlyOnceWith('new-image')
  })

  it('informa si falla también la limpieza después de un error de persistencia', async () => {
    profile.update.mockRejectedValue(new Error('database failed'))
    deleteAvatar.mockRejectedValue(Object.assign(new Error('No se pudo completar la limpieza de imágenes'), { status: 503 }))
    const response = await sendAvatar(await imageBuffer())
    expect(response.status).toBe(503)
    expect(deleteAvatar).toHaveBeenCalledExactlyOnceWith('new-image')
  })

  it('relee el avatar actual bajo bloqueo y limpia el anterior solo después de confirmar', async () => {
    profile.avatar_url = 'https://example.com/previous.webp'
    getOwnedAvatarId.mockReturnValue('previous-image')
    let committed = false
    sequelize.transaction.mockImplementation(async (callback) => {
      await callback({ LOCK: { UPDATE: 'UPDATE' } })
      committed = true
    })
    deleteAvatar.mockImplementation(async () => {
      expect(committed).toBe(true)
      expect(profile.avatar_url).toBe(avatarUrl)
    })
    expect((await sendAvatar(await imageBuffer())).status).toBe(200)
    expect(Profile.findOne).toHaveBeenLastCalledWith({ where: { id: 2, user_id: 1 }, transaction: expect.any(Object), lock: 'UPDATE' })
    expect(deleteAvatar).toHaveBeenCalledExactlyOnceWith('previous-image')
  })

  it('mantiene el nuevo avatar si la limpieza del anterior falla', async () => {
    getOwnedAvatarId.mockReturnValue('previous-image')
    deleteAvatar.mockRejectedValue(new Error('cleanup failed'))
    const response = await sendAvatar(await imageBuffer())
    expect(response.status).toBe(200)
    expect(response.body.avatar_url).toBe(avatarUrl)
    expect(response.body.message).toContain('limpieza')
    expect(deleteAvatar).toHaveBeenCalledExactlyOnceWith('previous-image')
  })

  it('no cambia el funcionamiento JSON de POST y PUT de perfiles', async () => {
    vi.spyOn(Profile, 'findOrCreate').mockResolvedValue([profile, true])
    const body = { name: 'Ana', last_name: 'Pérez', nickname: '', avatar_url: null }
    const created = await request(app).post('/api/profiles').set('Authorization', 'Bearer test-only').send({ ...body, user_id: 1 })
    const updated = await request(app).put('/api/profiles/2').set('Authorization', 'Bearer test-only').send(body)
    expect(created.status).toBe(201)
    expect(updated.status).toBe(200)
    expect(uploadAvatar).not.toHaveBeenCalled()
  })
})
