export const getHealth = (req, res) => {
  res.set('Cache-Control', 'no-store')
  if (req.app.locals.shuttingDown) return res.status(503).json({ status: 'unavailable' })
  return res.status(200).json({ status: 'ok' })
}
