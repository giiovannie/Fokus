import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useAppData } from '../../hooks/useAppData.js'
import { getOnboarding, saveOnboarding, OPEN_TUTORIAL_EVENT } from '../../services/onboarding.service.js'
import { getSession } from '../../utils/authSession.js'
import { tourSteps } from '../../utils/guidedTour.js'
import { GuidedTourSpotlight } from './GuidedTourSpotlight.jsx'
import '../../styles/guided-tour.css'

const StudentOnboarding = () => {
  const { user } = useAuth(), { data, isLoading } = useAppData()
  const navigate = useNavigate(), location = useLocation()
  const [progress, setProgress] = useState(null), [welcome, setWelcome] = useState(false), [running, setRunning] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(null), [reload, setReload] = useState(0)
  const epoch = useRef(0), currentUser = useRef(user?.id), mounted = useRef(false), following = useRef(false)
  const academic = useRef(false)
  const requested = useRef(false)
  const invalidate = useCallback(() => { epoch.current++ }, [])
  useEffect(() => { currentUser.current = user?.id; academic.current = Boolean(data.subjects.length || data.tasks.length || data.exams.length) }, [user?.id, data.subjects.length, data.tasks.length, data.exams.length])
  useEffect(() => {
    let active = true
    mounted.current = true
    if (!user || user.role === 'superadmin' || isLoading || !data.profile.id) return () => { mounted.current = false }
    const timer = setTimeout(() => {
      getOnboarding().then(saved => {
        if (!['not_started', 'in_progress', 'paused', 'skipped', 'completed'].includes(saved?.status) || !Number.isInteger(saved.step) || saved.step < 0 || saved.step >= tourSteps.length) throw new Error('No pudimos cargar el recorrido.')
        if (active && getSession()?.user.id === user.id) { setProgress(saved); setWelcome(requested.current || saved.status === 'not_started' && !academic.current); setError(null) }
      }).catch(failure => { if (active && requested.current) setError(failure.message) })
    }, 0)
    return () => { active = false; mounted.current = false; clearTimeout(timer); invalidate() }
  }, [user, isLoading, data.profile.id, reload, invalidate])
  const update = async (step, status, follow = false) => {
    const userId = user.id, actionEpoch = epoch.current
    if (getSession()?.user.id !== userId) return
    setBusy(true); setError(null)
    try {
      const saved = await saveOnboarding({ step, status, revision: progress.revision })
      if (!mounted.current || currentUser.current !== userId || getSession()?.user.id !== userId) return
      setProgress(saved)
      if (actionEpoch !== epoch.current) return
      if (follow || status === 'skipped' || status === 'completed') {
        following.current = true
        document.querySelector('dialog[open] .btn-close')?.click()
        following.current = false
      }
      if (follow) {
        setWelcome(false); setRunning(true); navigate(tourSteps[step].path)
      } else { setRunning(false); setWelcome(false) }
    } catch (failure) { if (mounted.current && currentUser.current === userId) setError(failure.message || 'No se pudo guardar el recorrido. Podés reintentar.') }
    finally { if (mounted.current && currentUser.current === userId) setBusy(false) }
  }
  const pause = (keepForm = false) => {
    epoch.current++; setRunning(false); setWelcome(false)
    if (!keepForm) {
      following.current = true; document.querySelector('dialog[open] .btn-close')?.click(); following.current = false
    }
    if (!busy && progress) void update(progress.step, 'paused')
  }
  useEffect(() => {
    const repeat = () => { requested.current = true; invalidate(); setRunning(false); if (progress) setWelcome(true); else setReload(value => value + 1) }
    window.addEventListener(OPEN_TUTORIAL_EVENT, repeat)
    return () => window.removeEventListener(OPEN_TUTORIAL_EVENT, repeat)
  }, [progress, invalidate])
  useEffect(() => {
    if (!running && !welcome) return
    const keyboard = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); pause() } }
    const editing = event => {
      if (running && !following.current && !event.target.closest('[data-tour-card]') && event.target.closest('dialog, form')) pause(true)
    }
    window.addEventListener('keydown', keyboard, true)
    if (running) { window.addEventListener('input', editing, true); window.addEventListener('click', editing, true) }
    return () => { window.removeEventListener('keydown', keyboard, true); window.removeEventListener('input', editing, true); window.removeEventListener('click', editing, true) }
  })
  if (!user || user.role === 'superadmin' || isLoading || !data.profile.id) return null
  const step = progress && tourSteps[progress.step]
  return <>
    {welcome && progress && <section className="guided-tour-welcome" aria-labelledby="tour-welcome-title">
      <h2 className="h5" id="tour-welcome-title">Bienvenido a Fokus</h2><p>Te acompañamos por las secciones reales. El recorrido no crea registros ni cambia tus preferencias. Podés pausarlo cuando quieras.</p>
      <div className="d-flex flex-wrap gap-2"><button className="btn btn-primary" disabled={busy} onClick={() => update(0, 'in_progress', true)}>Comenzar recorrido</button><button className="btn btn-outline-secondary" disabled={busy} onClick={() => update(progress.step, 'skipped')}>Omitir</button></div>
    </section>}
    {!running && !welcome && progress && ['paused', 'in_progress'].includes(progress.status) && <div className="alert alert-info d-flex flex-wrap align-items-center gap-2"><span>Recorrido pendiente · paso {progress.step + 1} de {tourSteps.length}.</span><button className="btn btn-sm btn-outline-primary" disabled={busy} onClick={() => update(progress.step, 'in_progress', true)}>Retomar recorrido</button></div>}
    {error && <div className="alert alert-warning" role="alert">{error} <button className="btn btn-sm btn-outline-secondary" onClick={() => { epoch.current++; setRunning(false); setError(null); setReload(value => value + 1) }}>Volver a cargar recorrido</button></div>}
    {running && step && location.pathname === step.path && <GuidedTourSpotlight key={progress.step} step={step}>
      {ready => <>
      <p className="small text-secondary mb-1">Paso {progress.step + 1} de {tourSteps.length}</p><h2 className="h5">{step.title}</h2><p id="guided-tour-description">{step.text}</p>
      <div className="d-flex flex-wrap gap-2"><button className="btn btn-outline-secondary" disabled={busy || progress.step === 0} onClick={() => update(progress.step - 1, 'in_progress', true)}>Anterior</button><button className="btn btn-primary" disabled={busy || !ready} onClick={() => progress.step === tourSteps.length - 1 ? update(progress.step, 'completed') : update(progress.step + 1, 'in_progress', true)}>{progress.step === tourSteps.length - 1 ? 'Completar recorrido' : 'Siguiente'}</button><button className="btn btn-outline-secondary" onClick={() => pause()}>Pausar</button><button className="btn btn-link" disabled={busy} onClick={() => update(progress.step, 'skipped')}>Finalizar recorrido</button></div>
      </>}
    </GuidedTourSpotlight>}
    {running && step && location.pathname !== step.path && <div className="alert alert-info"><button className="btn btn-sm btn-outline-primary" onClick={() => pause()}>Pausar recorrido</button></div>}
  </>
}
export const GuidedOnboarding = () => {
  const { user } = useAuth()
  return <StudentOnboarding key={user?.id} />
}
