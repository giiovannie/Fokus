import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { Avatar } from '../components/common/Avatar.jsx'
import { useAppData } from '../hooks/useAppData.js'
import { useAuth } from '../hooks/useAuth.js'

const ProfilePage = () => {
  const { data, updateProfile, uploadProfileImage, notify } = useAppData()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(data.profile)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const fileInput = useRef(null)

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const selectImage = (event) => {
    const selected = event.target.files[0]
    setFeedback(null)
    if (selected && (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 5 * 1024 * 1024)) {
      event.target.value = ''
      setFile(null)
      setPreviewUrl(null)
      setFeedback({ error: true, message: 'Seleccioná una imagen JPEG, PNG o WebP de hasta 5 MB.' })
      return
    }
    setFile(selected ?? null)
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setFeedback(null)
    const { name, last_name, nickname } = form
    const profile = { name, last_name, nickname }
    try {
      const saved = file ? await uploadProfileImage(file, profile) : await updateProfile(profile)
      if (saved) {
        setFile(null)
        setPreviewUrl(null)
        if (fileInput.current) fileInput.current.value = ''
        const message = saved.message ?? 'Perfil actualizado.'
        setFeedback({ error: false, message })
        notify(message, saved.message ? 'warning' : 'success')
      } else {
        setFeedback({ error: true, message: 'No se pudo completar el guardado. Tu foto anterior se conserva; podés volver a intentarlo.' })
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Cuenta" title="Tu perfil" description="Personalizá cómo querés verte en Fokus." />
      <div className="row g-4">
        <div className="col-12 col-lg-4"><div className="card border-0 text-center"><div className="card-body p-4"><Avatar profile={data.profile} className="profile-avatar mx-auto mb-3" /><h2 className="h5 mb-1">{form.name} {form.last_name}</h2><p className="text-secondary">@{form.nickname}</p><p className="small mb-4">{user?.email}</p><button className="btn btn-outline-danger" disabled={isSaving} onClick={() => { signOut(); navigate('/login') }} type="button">Cerrar sesión</button></div></div></div>
        <div className="col-12 col-lg-8"><div className="card border-0"><div className="card-body p-4 p-md-5"><h2 className="h5 mb-4">Información personal</h2><form onSubmit={submit}><fieldset disabled={isSaving}><div className="row g-3">
          {[['name', 'Nombre'], ['last_name', 'Apellido'], ['nickname', 'Apodo']].map(([field, label]) => <div className="col-12 col-md-6" key={field}><label className="form-label" htmlFor={`profile-${field}`}>{label}</label><input className="form-control" id={`profile-${field}`} value={form[field] ?? ''} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /></div>)}
          <div className="col-12">
            <label className="form-label" htmlFor="profile-avatar">Foto de perfil</label>
            <input className="form-control" id="profile-avatar" type="file" ref={fileInput} accept="image/jpeg,image/png,image/webp" onChange={selectImage} aria-describedby="profile-avatar-help" />
            <p className="small text-secondary mt-2" id="profile-avatar-help">JPEG, PNG o WebP, hasta 5 MB. La foto se sube al guardar el perfil.</p>
            {previewUrl && <div><img src={previewUrl} className="profile-avatar mb-2 object-fit-cover" alt="Vista previa de la foto seleccionada" /><button type="button" className="btn btn-outline-secondary ms-2" onClick={() => { setFile(null); setPreviewUrl(null); fileInput.current.value = ''; setFeedback(null) }}>Cancelar selección</button></div>}
          </div>
          <div className="col-12"><button className="btn btn-primary mt-2" type="submit">{isSaving ? 'Guardando…' : 'Guardar perfil'}</button></div>
        </div></fieldset>{isSaving && <p className="mt-3" role="status">Guardando el perfil y la foto seleccionada…</p>}{feedback && <p className={`mt-3 text-${feedback.error ? 'danger' : 'success'}`} role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}</form></div></div></div>
      </div>
    </>
  )
}

export { ProfilePage }
