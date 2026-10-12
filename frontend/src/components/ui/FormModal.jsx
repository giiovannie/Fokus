import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

export const FormModal = ({ open, title, onClose, busy = false, error, formId, submitLabel, danger = false, children }) => {
  const dialog = useRef(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement
    const element = dialog.current
    const previousOverflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    element.querySelector('input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')?.focus()
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [open])
  if (!open) return null
  return createPortal(<dialog ref={dialog} className="form-modal" aria-labelledby={titleId} aria-modal="true" aria-busy={busy} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="modal-content">
      <div className="modal-header"><h2 className="modal-title h5" id={titleId}>{title}</h2><button className="btn-close" type="button" aria-label="Cerrar formulario" disabled={busy} onClick={onClose} /></div>
      <div className="modal-body">{error && <p className="alert alert-danger" role="alert">{error}</p>}<fieldset disabled={busy}>{children}</fieldset></div>
      <div className="modal-footer">{busy && <span role="status">Guardando…</span>}<button className="btn btn-outline-secondary" type="button" disabled={busy} onClick={onClose}>Cancelar</button>{formId && <button className={'btn btn-' + (danger ? 'danger' : 'primary')} type="submit" form={formId} disabled={busy}>{submitLabel ?? title}</button>}</div>
    </div>
  </dialog>, document.body)
}
