import { Profile } from '../models/index.js'
import { withUserLock } from '../utils/withUserLock.js'
import { createHttpError } from '../utils/httpError.js'

const emptyProgress = { version: 1, status: 'not_started', step: 0, revision: 0 }
const progress = profile => ({ ...emptyProgress, ...(profile.preferences?.onboarding || {}) })
export const getOnboarding = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ where: { user_id: req.user.id } })
    if (!profile) throw createHttpError(404, 'Completá tu perfil antes de iniciar el recorrido.')
    const saved = progress(profile)
    return res.json({ version: 1, status: saved.status, step: saved.step, revision: saved.revision })
  } catch (error) { return next(error) }
}
export const putOnboarding = async (req, res, next) => {
  try {
    const saved = await withUserLock(req.user.id, async transaction => {
      const profile = await Profile.findOne({ where: { user_id: req.user.id }, transaction, lock: transaction.LOCK.UPDATE })
      if (!profile) throw createHttpError(404, 'Completá tu perfil antes de iniciar el recorrido.')
      const current = progress(profile)
      if (current.revision !== req.body.revision) throw createHttpError(409, 'El recorrido cambió en otra sesión. Volvé a cargarlo para continuar.')
      const updated = { version: 1, status: req.body.status, step: req.body.step, revision: current.revision + 1 }
      await profile.update({ preferences: { ...(profile.preferences || {}), onboarding: updated } }, { transaction })
      return updated
    })
    return res.json(saved)
  } catch (error) { return next(error) }
}
