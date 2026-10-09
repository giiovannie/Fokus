import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProvider } from '../context/AppContext.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'
import { useAppData } from '../hooks/useAppData.js'
import { clearSession, saveSession } from '../utils/authSession.js'
import { ProfilePage } from './ProfilePage.jsx'
import { Topbar } from '../components/common/Topbar.jsx'

const oldUrl = 'https://example.com/old.webp'
const newUrl = 'https://example.com/new.webp'
const profile = { id: 2, user_id: 7, name: 'Ana', last_name: 'Pérez', nickname: 'Ana', avatar_url: oldUrl }
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const image = (name = 'avatar.png', type = 'image/png') => new File(['test image'], name, { type })

const Page = ({ topbar }) => {
  const { isLoading } = useAppData()
  return isLoading ? <p>Cargando</p> : <>{topbar && <Topbar onMenu={() => {}} />}<ProfilePage /></>
}

const renderProfile = (overrides = {}) => {
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (String(url).endsWith('/avatar')) return overrides.upload ? overrides.upload() : response({ ...profile, avatar_url: newUrl })
    if (options.method === 'POST' && String(url).endsWith('/profiles')) {
      return overrides.create ? overrides.create() : response({ ...profile, avatar_url: null }, 201)
    }
    if (options.method === 'PUT') return response({ ...profile, avatar_url: overrides.missing ? null : oldUrl })
    if (String(url).endsWith('/profiles/7')) return overrides.missing ? response({ message: 'Sin perfil' }, 404) : response(overrides.profile ?? profile)
    return response([])
  })
  vi.stubGlobal('fetch', fetchMock)
  const view = render(<MemoryRouter><AuthProvider><AppProvider><Page topbar={overrides.topbar} /></AppProvider></AuthProvider></MemoryRouter>)
  return { ...view, fetchMock }
}

describe('foto de perfil', () => {
  beforeEach(() => {
    saveSession({ user: { id: 7, email: 'test@example.com' }, token: 'test-only' })
    const OriginalURL = globalThis.URL
    vi.stubGlobal('URL', class extends OriginalURL {
      static createObjectURL = vi.fn().mockReturnValueOnce('blob:avatar-preview').mockReturnValue('blob:avatar-preview-2')
      static revokeObjectURL = vi.fn()
    })
  })
  afterEach(() => {
    cleanup()
    clearSession()
    vi.unstubAllGlobals()
  })

  it('sincroniza Navbar y Perfil al subir y recupera la foto al ingresar nuevamente', async () => {
    const user = userEvent.setup()
    const view = renderProfile({ topbar: true })
    await screen.findByLabelText('Nombre')
    expect(screen.getAllByAltText('Foto de perfil')).toHaveLength(2)
    for (const avatar of screen.getAllByAltText('Foto de perfil')) expect(avatar).toHaveAttribute('src', oldUrl)
    await user.upload(screen.getByLabelText('Foto de perfil', { selector: 'input' }), image())
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }))
    await screen.findByText('Perfil actualizado.')
    for (const avatar of screen.getAllByAltText('Foto de perfil')) expect(avatar).toHaveAttribute('src', newUrl)
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(window.localStorage.getItem('task-organization-session')).toBeNull()
    view.unmount()
    saveSession({ user: { id: 7, email: 'test@example.com' }, token: 'test-only' })
    renderProfile({ topbar: true, profile: { ...profile, avatar_url: newUrl } })
    await screen.findByLabelText('Nombre')
    expect(screen.getAllByAltText('Foto de perfil')).toHaveLength(2)
    for (const avatar of screen.getAllByAltText('Foto de perfil')) expect(avatar).toHaveAttribute('src', newUrl)
  })

  it('previsualiza sin subir; cancela y libera la URL temporal', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderProfile()
    await user.upload(await screen.findByLabelText('Foto de perfil', { selector: 'input' }), image())
    expect(screen.getByAltText('Vista previa de la foto seleccionada')).toHaveAttribute('src', 'blob:avatar-preview')
    expect(screen.getByAltText('Foto de perfil')).toHaveAttribute('src', oldUrl)
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/avatar'))).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Cancelar selección' }))
    expect(screen.queryByAltText('Vista previa de la foto seleccionada')).not.toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:avatar-preview')
  })

  it('libera la vista previa al cambiar de archivo y desmontar', async () => {
    const user = userEvent.setup()
    const view = renderProfile()
    const input = await screen.findByLabelText('Foto de perfil', { selector: 'input' })
    await user.upload(input, image())
    await user.upload(input, image('another.webp', 'image/webp'))
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
  })

  it('muestra carga y actualiza la foto únicamente después de la respuesta exitosa', async () => {
    const user = userEvent.setup()
    let resolveUpload
    const pending = new Promise((resolve) => { resolveUpload = resolve })
    const { fetchMock } = renderProfile({ upload: () => pending })
    await user.upload(await screen.findByLabelText('Foto de perfil', { selector: 'input' }), image())
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/avatar'))).toBe(true))
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    expect(screen.getByAltText('Foto de perfil')).toHaveAttribute('src', oldUrl)
    await act(async () => resolveUpload(response({ ...profile, avatar_url: newUrl })))
    expect(await screen.findByText('Perfil actualizado.')).toBeInTheDocument()
    expect(screen.getByAltText('Foto de perfil')).toHaveAttribute('src', newUrl)
    expect(screen.queryByAltText('Vista previa de la foto seleccionada')).not.toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalled()
    const [url, options] = fetchMock.mock.calls.find(([path]) => String(path).endsWith('/avatar'))
    expect(url).toEqual(expect.stringContaining('/profiles/2/avatar'))
    expect(options.body.get('avatar').name).toBe('avatar.png')
    expect(options.headers.Authorization).toBe('Bearer test-only')
    expect(options.headers).not.toHaveProperty('Content-Type')
  })

  it('conserva la foto anterior y permite reintentar si falla la subida', async () => {
    const user = userEvent.setup()
    renderProfile({ upload: () => response({ message: 'Almacenamiento no disponible' }, 503) })
    await user.upload(await screen.findByLabelText('Foto de perfil', { selector: 'input' }), image())
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu foto anterior se conserva')
    expect(screen.getByAltText('Foto de perfil')).toHaveAttribute('src', oldUrl)
    expect(screen.getByRole('button', { name: 'Guardar perfil' })).toBeEnabled()
    expect(screen.getByAltText('Vista previa de la foto seleccionada')).toBeInTheDocument()
  })

  it('crea el perfil antes de subir y reutiliza su ID al reintentar una subida fallida', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderProfile({ missing: true, upload: () => response({ message: 'Subida fallida' }, 502) })
    await user.type(await screen.findByLabelText('Nombre'), 'Ana')
    await user.type(screen.getByLabelText('Apellido'), 'Pérez')
    await user.upload(screen.getByLabelText('Foto de perfil', { selector: 'input' }), image())
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }))
    await screen.findByRole('alert')
    const mutations = fetchMock.mock.calls.filter(([, options]) => options.method)
    expect(mutations.map(([url, options]) => [String(url).split('/profiles')[1], options.method])).toEqual([['', 'POST'], ['/2/avatar', 'POST']])
    expect(JSON.parse(mutations[0][1].body)).toEqual({ name: 'Ana', last_name: 'Pérez', nickname: '', user_id: 7 })
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }))
    await screen.findByRole('alert')
    expect(fetchMock.mock.calls.filter(([url, options]) => String(url).endsWith('/profiles') && options.method === 'POST')).toHaveLength(1)
    expect(fetchMock.mock.calls.some(([url, options]) => String(url).endsWith('/profiles/2') && options.method === 'PUT')).toBe(true)
  })

  it('no sube si falla la creación del perfil', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderProfile({ missing: true, create: () => response({ message: 'Nombre requerido' }, 400) })
    await user.upload(await screen.findByLabelText('Foto de perfil', { selector: 'input' }), image())
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }))
    await screen.findByRole('alert')
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/avatar'))).toBe(false)
  })

  it('guarda datos personales sin reenviar una URL de avatar obsoleta', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderProfile()
    await screen.findByLabelText('Nombre')
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }))
    await screen.findByText('Perfil actualizado.')
    const [, options] = fetchMock.mock.calls.find(([, opts]) => opts.method === 'PUT')
    expect(JSON.parse(options.body)).toEqual({ name: 'Ana', last_name: 'Pérez', nickname: 'Ana' })
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/avatar'))).toBe(false)
  })

  it.each(['image/svg+xml', 'image/gif'])('rechaza %s sin enviarlo', async (type) => {
    const user = userEvent.setup({ applyAccept: false })
    const { fetchMock } = renderProfile()
    await user.upload(await screen.findByLabelText('Foto de perfil', { selector: 'input' }), image('invalid', type))
    expect(screen.getByRole('alert')).toHaveTextContent('hasta 5 MB')
    expect(screen.queryByAltText('Vista previa de la foto seleccionada')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/avatar'))).toBe(false)
  })

  it('rechaza archivos mayores de 5 MB', async () => {
    const user = userEvent.setup()
    renderProfile()
    const file = image()
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 })
    await user.upload(await screen.findByLabelText('Foto de perfil', { selector: 'input' }), file)
    expect(screen.getByRole('alert')).toHaveTextContent('hasta 5 MB')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('muestra el aviso de limpieza pendiente aun cuando la foto fue guardada', async () => {
    const user = userEvent.setup()
    const message = 'La imagen fue guardada, pero la limpieza de la imagen anterior quedó pendiente'
    renderProfile({ upload: () => response({ ...profile, avatar_url: newUrl, message }) })
    await user.upload(await screen.findByLabelText('Foto de perfil', { selector: 'input' }), image())
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByAltText('Foto de perfil')).toHaveAttribute('src', newUrl)
  })
})
