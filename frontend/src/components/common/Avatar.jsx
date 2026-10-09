import { useState } from 'react'

const AvatarImage = ({ url, initials, className, label }) => {
  const [failed, setFailed] = useState(false)
  return url && !failed
    ? <img src={url} alt={label} className={`${className} object-fit-cover`} onError={() => setFailed(true)} />
    : <span className={className} role="img" aria-label={label}>{initials}</span>
}

const Avatar = ({ profile, className = '', label = 'Foto de perfil' }) => {
  let url = null
  try {
    const parsed = new URL(profile?.avatar_url)
    if (['https:', 'http:'].includes(parsed.protocol)) url = parsed.href
  } catch {
    // Missing or malformed image URLs use the same initials fallback.
  }
  const initials = `${profile?.name?.trim().charAt(0) ?? ''}${profile?.last_name?.trim().charAt(0) ?? ''}`
  return <AvatarImage key={url ?? ''} url={url} initials={initials} className={className} label={label} />
}

export { Avatar }
