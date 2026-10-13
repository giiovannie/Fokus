import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { ActivityWheel } from '../components/common/ActivityWheel.jsx'
import { OwlMark } from '../components/common/OwlMark.jsx'
import { useAppData } from '../hooks/useAppData.js'
import { useAuth } from '../hooks/useAuth.js'
import { readRouletteExclusions, persistRouletteExclusions } from '../utils/rouletteExclusions.js'
import { buildRouletteOptions, nextRouletteComment, randomIndex, winningRotation } from '../utils/roulette.js'
import '../styles/roulette.css'

export const RoulettePage = () => {
  const { user } = useAuth()
  return <SubjectRoulette key={user?.id ?? 'anonymous'} userId={user?.id} />
}
const SubjectRoulette = ({ userId }) => {
  const { data, isLoading, error } = useAppData()
  const [excluded, setExcluded] = useState(() => readRouletteExclusions(userId))
  const [storageError, setStorageError] = useState(false)
  const [comments, setComments] = useState(true)
  const [comment, setComment] = useState(() => nextRouletteComment('before'))
  const [rotation, setRotation] = useState(0)
  const [duration, setDuration] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const timer = useRef(null), finish = useRef(null), locked = useRef(false), spins = useRef(0), lastComment = useRef({ before: comment })
  const options = useMemo(() => buildRouletteOptions(data), [data])
  const valid = new Set(options.map(option => option.key))
  const cleaned = new Set([...excluded].filter(key => valid.has(key)))
  if (!isLoading && !error && cleaned.size !== excluded.size) setExcluded(cleaned)
  const selected = options.filter(option => !excluded.has(option.key))
  const wheelOptions = snapshot || selected
  const availableWinner = winner && options.some(option => option.key === winner.key)
  useEffect(() => () => { clearTimeout(timer.current); finish.current = null }, [])
  useEffect(() => {
    // Una carga incompleta no acredita que las materias hayan sido eliminadas.
    if (isLoading || error || !userId) return
    persistRouletteExclusions(userId, excluded)
  }, [userId, options, excluded, isLoading, error])
  const say = (phase, activity) => {
    if (!comments) return
    const text = nextRouletteComment(phase, lastComment.current[phase], activity)
    lastComment.current[phase] = text; setComment(text)
  }
  const resetResult = () => { setWinner(null); setSnapshot(null); say('before') }
  const chooseExclusions = next => {
    if (locked.current || isLoading || error) return
    setExcluded(next)
    setStorageError(!persistRouletteExclusions(userId, next))
    resetResult()
  }
  const toggle = key => {
    if (locked.current) return
    const next = new Set(excluded)
    if (next.has(key)) next.delete(key); else next.add(key)
    chooseExclusions(next)
  }
  const spin = () => {
    if (locked.current || isLoading || error || !selected.length) return
    const pool = selected.slice(), chosen = pool[randomIndex(pool.length)]
    const index = pool.findIndex(option => option.key === chosen.key)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    locked.current = true; spins.current++
    setWinner(null); setSnapshot(pool); setSpinning(true); setDuration(reduced ? 0 : 4600)
    setRotation(winningRotation(rotation, index, pool.length))
    say(spins.current >= 3 ? 'repeat' : 'during')
    finish.current = () => {
      if (!locked.current) return
      clearTimeout(timer.current); locked.current = false; finish.current = null
      setSpinning(false); setWinner(chosen); say('after', chosen.label)
    }
    if (reduced) finish.current()
    else timer.current = setTimeout(() => finish.current?.(), 4700)
  }
  return <>
    <PageHeader eyebrow="Decidí y empezá" title="Ruleta" description="Elegí tus materias, girá y dejá que Fokus te dé el primer paso." />
    {storageError && <p className="alert alert-warning" role="status">No pudimos guardar tus exclusiones en este navegador. Se conservan mientras permanezcas en esta pantalla.</p>}
    {!options.length && !spinning && !winner ? <div className="card border-0"><EmptyState title="Tu ruleta está esperando materias" message="Agregá una materia para empezar." /><div className="d-flex justify-content-center flex-wrap gap-2 pb-4"><Link className="btn btn-outline-primary" to="/subjects">Ir a materias</Link><button className="btn btn-primary" disabled type="button">Girar ruleta</button></div></div> : <div className="row g-4 roulette-page">
      <div className="col-12 col-lg-7"><section className="card border-0 h-100"><div className="card-body p-3 p-sm-4 text-center">
        <h2 className="h5">Un giro, una decisión</h2>
        <p id="roulette-instructions" className="small text-secondary">Cada materia seleccionada tiene la misma probabilidad. Girar no cambia tus materias.</p>
        {wheelOptions.length ? <ActivityWheel options={wheelOptions} rotation={rotation} duration={duration} onFinish={() => finish.current?.()} /> : <EmptyState title="Elegí al menos una materia" message="Marcá las materias que querés incluir en el giro." />}
        <p className="small text-secondary">{wheelOptions.length} opciones en la ruleta{wheelOptions.length <= 36 ? '. Los números corresponden a la lista.' : '.'}</p>
        <button className="btn btn-primary btn-lg px-4" type="button" disabled={spinning || isLoading || !!error || !selected.length} aria-describedby="roulette-instructions" onClick={spin}>{spinning ? 'Girando…' : 'Girar ruleta'}</button>
        <div className="roulette-comment mt-3" aria-live="polite" aria-atomic="true">{comments && <p className="mb-0">{comment}</p>}</div>
        <div className="form-check form-switch d-inline-flex align-items-center gap-2 mt-2"><input id="roulette-comments" className="form-check-input" type="checkbox" checked={comments} onChange={event => setComments(event.target.checked)} /><label className="form-check-label small" htmlFor="roulette-comments">Comentarios de la ruleta</label></div>
        <div role="status" aria-live="polite" aria-atomic="true">{winner && <div className="roulette-result mt-4 p-3"><OwlMark variant="welcome" className="mascot-context mb-2" /><p className="small mb-1">Tu próxima materia</p><h3 className="h5">{winner.label}</h3>{availableWinner ? <Link className="btn btn-outline-primary" to={winner.href}>Ir a la materia</Link> : <p className="small mb-0">Esta materia ya no está disponible. Volvé a elegir tus opciones.</p>}</div>}</div>
      </div></section></div>
      <div className="col-12 col-lg-5"><section className="card border-0"><div className="card-body p-3 p-sm-4">
        <h2 className="h5">¿Qué entra en el giro?</h2><p className="small text-secondary">Tus materias participan por defecto. Desmarcá las que querés excluir.</p>
        <fieldset disabled={spinning || isLoading || !!error}>
          <legend className="visually-hidden">Materias que participan</legend>
          <div className="d-flex gap-2 mb-3"><button className="btn btn-sm btn-outline-primary" type="button" onClick={() => chooseExclusions(new Set())}>Seleccionar todas</button><button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => chooseExclusions(new Set(options.map(option => option.key)))}>Quitar todas</button></div>
          <div className="roulette-options">{options.map(option => {
            const number = wheelOptions.findIndex(item => item.key === option.key) + 1
            return <label className="roulette-option d-flex align-items-start gap-3 p-3" key={option.key}>
              <input className="form-check-input mt-1" type="checkbox" checked={!excluded.has(option.key)} onChange={() => toggle(option.key)} />
              <span className="flex-grow-1"><span className="d-block fw-semibold">{option.label}</span><span className="small text-secondary">Materia</span></span>
              {number > 0 && <span className="roulette-number" aria-hidden="true">{number}</span>}
            </label>
          })}</div>
        </fieldset>
      </div></section></div>
    </div>}
  </>
}
