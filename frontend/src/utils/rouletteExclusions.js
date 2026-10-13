const storageKey = userId => `fokus:roulette-excluded:${userId}`
const validUser = id => Number.isSafeInteger(Number(id)) && Number(id) > 0
export const readRouletteExclusions = (userId, storage) => {
  if (!validUser(userId)) return new Set()
  try {
    const target = storage === undefined ? globalThis.localStorage : storage
    const ids = JSON.parse(target?.getItem(storageKey(userId)) ?? '[]')
    return new Set((Array.isArray(ids) ? ids : []).filter(id => Number.isSafeInteger(id) && id > 0).map(id => 'subject:' + id))
  } catch { return new Set() }
}
export const persistRouletteExclusions = (userId, excluded, storage) => {
  if (!validUser(userId)) return false
  try {
    const target = storage === undefined ? globalThis.localStorage : storage
    if (!target) return false
    const ids = [...new Set([...excluded].filter(key => /^subject:\d+$/.test(key)).map(key => Number(key.slice('subject:'.length))).filter(id => Number.isSafeInteger(id) && id > 0))].sort((a, b) => a - b)
    const value = JSON.stringify(ids)
    if (target.getItem(storageKey(userId)) !== value) target.setItem(storageKey(userId), value)
    return true
  } catch { return false }
}
