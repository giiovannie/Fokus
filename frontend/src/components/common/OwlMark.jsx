const variants = { principal: 'mirada-fija', graduate: 'graduado', guide: 'lentes', welcome: 'saludando' }
export const OwlMark = ({ variant = 'principal', welcome = false, loading = false, className = '' }) => {
  const name = variants[variant] || variants.principal
  return <span className={`owl-mark ${welcome ? 'owl-welcome' : ''} ${loading ? 'owl-loading' : ''} ${className}`} aria-hidden="true">
    <img src={`/mascotas/buho-${name}-320.webp`} srcSet={`/mascotas/buho-${name}-160.webp 160w, /mascotas/buho-${name}-320.webp 320w`} sizes="(max-width: 575px) 96px, 128px" width="320" height="320" alt="" decoding="async" />
  </span>
}
