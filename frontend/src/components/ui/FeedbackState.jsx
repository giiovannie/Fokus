import { OwlMark } from '../common/OwlMark.jsx'

export const SuccessState = ({ message, onDismiss }) => <section className="mascot-success alert alert-success" role="status"><OwlMark variant="graduate" className="mascot-context" /><p className="mb-0">{message}</p>{onDismiss && <button className="btn btn-outline-success" type="button" onClick={onDismiss} aria-label="Cerrar felicitación">Cerrar</button>}</section>

export const LoadingState = ({ message = 'Cargando información…' }) => (
  <div className="loading-state" role="status" aria-live="polite">
    <OwlMark loading />
    <span>{message}<span className="loading-dots" aria-hidden="true"><span /><span /><span /></span></span>
  </div>
)

export const ErrorState = ({ message = 'No pudimos cargar la información.', onRetry }) => (
  <div aria-live="assertive" className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
    <span>{message}</span>
    {onRetry && <button className="btn btn-sm btn-outline-danger" onClick={onRetry} type="button">Reintentar</button>}
  </div>
)
