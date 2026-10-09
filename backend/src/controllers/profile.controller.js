import { Profile, sequelize } from '../models/index.js'
import { deleteAvatar, getOwnedAvatarId, uploadAvatar } from '../services/cloudinary.service.js'
import { createHttpError } from '../utils/httpError.js'
import { pick } from '../utils/pick.js'

const profileAttributes = ['id', 'user_id', 'name', 'last_name', 'nickname', 'avatar_url']

export const updateProfileAvatar = async (req, res, next) => {
  let uploaded
  let savedProfile
  let previousUrl
  try {
    uploaded = await uploadAvatar(req.avatarBuffer, req.user.id, req.profile.id)
    await sequelize.transaction(async (transaction) => {
      // Re-read under lock so simultaneous uploads replace the actual current avatar.
      savedProfile = await Profile.findOne({
        where: { id: req.profile.id, user_id: req.user.id }, transaction, lock: transaction.LOCK.UPDATE,
      })
      if (!savedProfile) throw createHttpError(404, 'El perfil no fue encontrado')
      previousUrl = savedProfile.avatar_url
      await savedProfile.update({ avatar_url: uploaded.url }, { transaction })
    })
  } catch (error) {
    if (uploaded) {
      try {
        await deleteAvatar(uploaded.publicId)
      } catch (cleanupError) {
        return next(cleanupError)
      }
    }
    return next(error)
  }

  const previousId = getOwnedAvatarId(previousUrl, req.user.id, req.profile.id)
  if (previousId) {
    try {
      await deleteAvatar(previousId)
    } catch {
      // The committed profile remains valid; never delete its new image on cleanup failure.
      return res.status(200).json({
        ...profileAttributes.reduce((data, key) => ({ ...data, [key]: savedProfile[key] }), {}),
        message: 'La imagen fue guardada, pero la limpieza de la imagen anterior quedó pendiente',
      })
    }
  }
  return res.status(200).json(profileAttributes.reduce((data, key) => ({ ...data, [key]: savedProfile[key] }), {}))
}

export const getProfile = async (req, res, next) => {
  try {
    if (req.user.id !== Number(req.params.userId)) {
      throw createHttpError(403, 'No tienes permiso para consultar este perfil')
    }

    const profile = await Profile.findOne({
      where: { user_id: req.user.id },
      attributes: profileAttributes,
    })

    if (!profile) throw createHttpError(404, 'El perfil no fue encontrado')
    return res.json(profile)
  } catch (error) {
    return next(error)
  }
}

export const createProfile = async (req, res, next) => {
  try {
    if (req.user.id !== Number(req.body.user_id)) {
      throw createHttpError(403, 'No tienes permiso para crear este perfil')
    }

    const [profile, created] = await Profile.findOrCreate({
      where: { user_id: req.user.id },
      defaults: pick(req.body, ['user_id', 'name', 'last_name', 'nickname', 'avatar_url']),
    })

    if (!created) throw createHttpError(409, 'El usuario ya tiene un perfil')
    return res.status(201).json(profileAttributes.reduce((data, key) => ({ ...data, [key]: profile[key] }), {}))
  } catch (error) {
    return next(error)
  }
}

export const updateProfile = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ where: { id: req.params.id, user_id: req.user.id } })
    if (!profile) throw createHttpError(404, 'El perfil no fue encontrado')

    await profile.update(pick(req.body, ['name', 'last_name', 'nickname', 'avatar_url']))
    return res.json(profileAttributes.reduce((data, key) => ({ ...data, [key]: profile[key] }), {}))
  } catch (error) {
    return next(error)
  }
}
