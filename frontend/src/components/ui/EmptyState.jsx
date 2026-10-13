import { OwlMark } from '../common/OwlMark.jsx'
const EmptyState = ({ title, message, mascot }) => (
  <div className="empty-state text-center py-5 px-3">
    {mascot ? <OwlMark variant={mascot} className="mascot-context mb-3" /> : <div className="empty-icon mb-3" aria-hidden="true">◇</div>}
    <h2 className="h5">{title}</h2>
    <p className="text-secondary mb-0">{message}</p>
  </div>
)

export { EmptyState }
