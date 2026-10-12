import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { v2 as cloudinary } from 'cloudinary'
import { deleteAvatar, deleteAccountAvatars, getOwnedAvatarId, uploadAvatar } from '../src/services/cloudinary.service.js'

vi.mock('cloudinary', () => ({ v2: { api: { delete_resources_by_prefix: vi.fn() }, config: vi.fn(), uploader: { upload_stream: vi.fn(), destroy: vi.fn() } } }))

describe('servicio Cloudinary', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'test-cloud')
    vi.stubEnv('CLOUDINARY_API_KEY', 'test-only')
    vi.stubEnv('CLOUDINARY_API_SECRET', 'test-only')
    cloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' })
    cloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
      const stream = new PassThrough()
      stream.on('finish', () => callback(null, {
        public_id: options.public_id,
        secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${options.public_id}.webp`,
      }))
      return stream
    })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('sube sin sobrescribir y usa un identificador generado para el propietario', async () => {
    const result = await uploadAvatar(Buffer.from('decoded image'), 1, 2)
    expect(result.publicId).toMatch(/^fokus\/avatars\/1\/2\/[0-9a-f-]{36}$/)
    expect(result.url).toMatch(/^https:/)
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(expect.objectContaining({ overwrite: false, resource_type: 'image' }), expect.any(Function))
    expect(getOwnedAvatarId(result.url, 1, 2)).toBe(result.publicId)
    expect(getOwnedAvatarId(result.url, 2, 2)).toBeNull()
    expect(getOwnedAvatarId(result.url.replace('test-cloud', 'other-cloud'), 1, 2)).toBeNull()
    expect(getOwnedAvatarId('https://example.com/photo.png', 1, 2)).toBeNull()
  })

  it('no contacta al proveedor sin configuración', async () => {
    vi.stubEnv('CLOUDINARY_API_SECRET', '')
    await expect(uploadAvatar(Buffer.from('image'), 1, 2)).rejects.toMatchObject({ status: 503 })
    expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled()
  })

  it('limpia una subida incierta y no devuelve errores privados de Cloudinary', async () => {
    cloudinary.uploader.upload_stream.mockImplementation((_, callback) => {
      const stream = new PassThrough()
      stream.on('finish', () => callback(new Error('private provider details')))
      return stream
    })
    await expect(uploadAvatar(Buffer.from('image'), 1, 2)).rejects.toMatchObject({ status: 502, message: 'No se pudo subir la imagen al almacenamiento' })
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(1)
  })

  it('rechaza URLs inseguras y elimina la subida', async () => {
    cloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
      const stream = new PassThrough()
      stream.on('finish', () => callback(null, { public_id: options.public_id, secure_url: 'http://example.com/image.webp' }))
      return stream
    })
    await expect(uploadAvatar(Buffer.from('image'), 1, 2)).rejects.toMatchObject({ status: 502 })
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(1)
  })

  it('reintenta la limpieza y acepta archivos ya eliminados', async () => {
    cloudinary.uploader.destroy.mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValue({ result: 'not found' })
    await expect(deleteAvatar('owned-image')).resolves.toBeUndefined()
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(2)
  })

  it('informa limpieza fallida después de tres intentos sin revelar secretos', async () => {
    cloudinary.uploader.destroy.mockRejectedValue(new Error('private provider details'))
    await expect(deleteAvatar('owned-image')).rejects.toMatchObject({ status: 503, message: 'No se pudo completar la limpieza de imágenes' })
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(3)
  })
})

describe('retiro de fotos de la cuenta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'test-cloud'); vi.stubEnv('CLOUDINARY_API_KEY', 'test-only'); vi.stubEnv('CLOUDINARY_API_SECRET', 'test-only')
    cloudinary.api.delete_resources_by_prefix.mockResolvedValue({ deleted: {}, partial: false })
  })
  afterEach(() => vi.unstubAllEnvs())
  it('usa un prefijo propio con separador y recorre resultados parciales', async () => {
    cloudinary.api.delete_resources_by_prefix.mockResolvedValueOnce({ deleted: { 'fokus/avatars/7/3/a': 'deleted' }, partial: true, next_cursor: 'test-cursor' })
    await deleteAccountAvatars(7, { required: true })
    expect(cloudinary.api.delete_resources_by_prefix).toHaveBeenCalledTimes(2)
    expect(cloudinary.api.delete_resources_by_prefix).toHaveBeenLastCalledWith('fokus/avatars/7/', expect.objectContaining({ next_cursor: 'test-cursor', invalidate: true }))
  })
  it('no acepta prefijos arbitrarios ni declara éxito con limpieza parcial', async () => {
    await expect(deleteAccountAvatars('../8')).rejects.toMatchObject({ status: 400 })
    expect(cloudinary.api.delete_resources_by_prefix).not.toHaveBeenCalled()
    cloudinary.api.delete_resources_by_prefix.mockResolvedValue({ deleted: {}, partial: true, next_cursor: 'test-cursor' })
    await expect(deleteAccountAvatars(7)).rejects.toMatchObject({ status: 503 })
    expect(cloudinary.api.delete_resources_by_prefix).toHaveBeenCalledTimes(3)
  })
})
