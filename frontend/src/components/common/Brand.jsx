import { Link } from 'react-router-dom'
import { OwlMark } from './OwlMark.jsx'

const Brand = () => (
  <Link className="navbar-brand fw-semibold" to="/" aria-label="Fokus, inicio">
    <OwlMark welcome className="brand-logo me-2" />
    Fokus
  </Link>
)

export { Brand }
