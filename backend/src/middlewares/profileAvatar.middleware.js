import multer from 'multer'
import sharp from 'sharp'
import { Profile } from '../models/index.js'
import { createHttpError } from '../utils/httpError.js'

export const authorizeProfileAvatar = async (req, res, next) => {
  try {
    req.profile = await Profile.findOne({ where: { id: req.params.id, user_id: req.user.id } })
    if (!req.profile) throw createHttpError(404, 'El perfil no fue encontrado o no tienes permiso')
    return next()
  } catch (error) {
    return next(error)
  }
}

const receiveAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
}).single('avatar')

export const uploadProfileAvatar = (req, res, next) => {
  receiveAvatar(req, res, (error) => {
    if (error) {
      return next(createHttpError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
        error.code === 'LIMIT_FILE_SIZE' ? 'La imagen no puede superar 5 MB' : 'Envía un único archivo en el campo avatar'))
    }
    return next()
  })
}

export const validateProfileAvatar = async (req, res, next) => {
  if (!req.file) return next(createHttpError(400, 'Debes seleccionar una imagen'))
  try {
    const { buffer } = req.file
    const isJpeg = buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    const isPng = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    const isWebp = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
    if (!isJpeg && !isPng && !isWebp) throw new Error('unsupported image')
    const image = sharp(req.file.buffer, { limitInputPixels: 16_000_000, failOn: 'warning' })
    const metadata = await image.metadata()
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages ?? 1) > 1) {
      throw new Error('unsupported image')
    }
    // Decode and re-encode pixels: reject damaged files and strip client metadata.
    req.avatarBuffer = await image.rotate().resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).webp().toBuffer()
    return next()
  } catch {
    return next(createHttpError(400, 'La imagen debe ser JPEG, PNG o WebP válida, estática y de hasta 16 megapíxeles'))
  }
}
