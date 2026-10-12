export const OwlMark = ({ welcome = false, loading = false, className = '' }) => (
  <span className={`owl-mark ${welcome ? 'owl-welcome' : ''} ${loading ? 'owl-loading' : ''} ${className}`} aria-hidden="true">
    <img src="/icons/fokus-logo.png" alt="" />
  </span>
)
