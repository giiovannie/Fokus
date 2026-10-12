import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { beforeEach, afterEach } from 'vitest'

afterEach(() => cleanup())

// jsdom no implementa el diálogo nativo; el navegador conserva su foco/inert reales.
beforeEach(() => {
  if (typeof HTMLDialogElement === 'undefined') return
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
