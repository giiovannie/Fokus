import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { placeTourCard } from '../../utils/guidedTour.js'

export const GuidedTourSpotlight = ({ step, children }) => {
  const [position, setPosition] = useState({ left: 12, top: 12, width: 320 })
  const [host, setHost] = useState(document.body)
  const [ready, setReady] = useState(false)
  const card = useRef(null)
  useEffect(() => { if (ready) card.current?.focus({ preventScroll: true }) }, [host, ready])
  useEffect(() => {
    let target, described, frame, attemptedOpen = false, active = true
    const locate = () => {
      if (!active) return
      const modal = document.querySelector('dialog[open]')
      const element = document.querySelector(step.target)
      if (!element) {
        if (step.open && !attemptedOpen && !modal) {
          const button = document.querySelector(step.open)
          if (button) { attemptedOpen = true; button.click() }
        }
        return
      }
      if (target !== element) {
        target?.classList.remove('guided-tour-highlight')
        target = element; described = target.getAttribute('aria-describedby')
        target.classList.add('guided-tour-highlight')
        target.setAttribute('aria-describedby', [described, 'guided-tour-description'].filter(Boolean).join(' '))
        target.scrollIntoView?.({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
        card.current?.focus({ preventScroll: true })
      }
      setHost(target.closest('dialog[open]') || document.body); setReady(true)
      const rect = target.getBoundingClientRect()
      const next = placeTourCard(rect, window.visualViewport?.width || window.innerWidth, window.visualViewport?.height || window.innerHeight, card.current?.getBoundingClientRect().height || 260, { left: window.visualViewport?.offsetLeft || 0, top: window.visualViewport?.offsetTop || 0 })
      setPosition(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(locate) }
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', schedule); window.addEventListener('scroll', schedule, true)
    window.visualViewport?.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)
    schedule()
    return () => {
      active = false; cancelAnimationFrame(frame); observer.disconnect()
      window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true)
      window.visualViewport?.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('scroll', schedule)
      target?.classList.remove('guided-tour-highlight')
      if (target) { if (described) target.setAttribute('aria-describedby', described); else target.removeAttribute('aria-describedby') }
    }
  }, [step])
  return createPortal(<section className="guided-tour-card card" data-tour-card ref={card} tabIndex="-1" role="region" aria-label="Tutorial de Fokus" style={position}>
    {!ready && <p role="status">Preparando el elemento del recorrido…</p>}
    {typeof children === 'function' ? children(ready) : children}
  </section>, host)
}
