import { randomUUID } from 'node:crypto'
import { v2 as cloudinary } from 'cloudinary'
import { createHttpError } from '../utils/httpError.js'

const configureCloudinary = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw createHttpError(503, 'El almacenamiento de imágenes no está configurado')
  }
  cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true })
}

export const deleteAvatar = async (publicId) => {
  configureCloudinary()
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true })
      if (!['ok', 'not found'].includes(result.result)) throw new Error('cleanup failed')
      return
    } catch {
      if (attempt === 2) throw createHttpError(503, 'No se pudo completar la limpieza de imágenes')
    }
  }
}

export const uploadAvatar = async (buffer, userId, profileId) => {
  configureCloudinary()
  const publicId = `fokus/avatars/${userId}/${profileId}/${randomUUID()}`
  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        public_id: publicId, resource_type: 'image', overwrite: false, allowed_formats: ['webp'], timeout: 30_000,
      }, (error, uploaded) => error ? reject(error) : resolve(uploaded))
      stream.on('error', reject)
      stream.end(buffer)
    })
    if (result.public_id !== publicId || typeof result.secure_url !== 'string'
      || result.secure_url.length > 500 || getOwnedAvatarId(result.secure_url, userId, profileId) !== publicId) {
      throw new Error('invalid upload response')
    }
    return { publicId, url: result.secure_url }
  } catch {
    // The provider may have stored the file even when its response was lost.
    await deleteAvatar(publicId)
    throw createHttpError(502, 'No se pudo subir la imagen al almacenamiento')
  }
}

export const getOwnedAvatarId = (url, userId, profileId) => {
  if (!url || !process.env.CLOUDINARY_CLOUD_NAME) return null
  const prefix = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`
  if (!url.startsWith(prefix)) return null
  const path = url.slice(prefix.length).replace(/^v\d+\//, '')
  const match = path.match(new RegExp(`^(fokus/avatars/${Number(userId)}/${Number(profileId)}/[0-9a-f-]{36})\\.webp$`))
  return match?.[1] ?? null
}
