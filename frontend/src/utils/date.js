const toLocalDate = (value) => new Date(`${value}T00:00:00`)

export const formatDate = (value) => !value ? 'Sin fecha de entrega' : new Intl.DateTimeFormat('es-AR', {
  day: '2-digit', month: 'short', year: 'numeric',
}).format(toLocalDate(value))

export const daysRemaining = (value) => {
  if (!value) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((toLocalDate(value) - today) / 86400000)
}

export const urgencyClass = (days) => {
  if (days == null) return 'info'
  if (days <= 3) return 'danger'
  if (days <= 7) return 'warning'
  return 'info'
}
