import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificationTester } from './NotificationTester.jsx'
import { NotificationPhrasesEditor } from './NotificationPhrasesEditor.jsx'
import { sendLocalNotification } from '../../services/localNotifications.js'
import { createNotificationPhrase, updateNotificationPhrase, deleteNotificationPhrase, getNotificationPreview, sendPushTest } from '../../services/notifications.service.js'
vi.mock('../../services/localNotifications.js', () => ({ sendLocalNotification: vi.fn() }))
vi.mock('../../services/notifications.service.js', () => ({ createNotificationPhrase: vi.fn(), updateNotificationPhrase: vi.fn(), deleteNotificationPhrase: vi.fn(), getNotificationPreview: vi.fn(), sendPushTest: vi.fn() }))
getNotificationPreview.mockImplementation(async ({ event_type: type, style, previous_phrase: previous }) => {
  const phrase = style === 'sarcastic' ? previous === 'El examen no se va a rendir solo' ? 'Tu yo del futuro' : 'El examen no se va a rendir solo'
    : style === 'unfiltered' ? 'Dejá de boludear' : style === 'custom' ? 'Mi entrega personalizada' : 'Le recordamos su próximo examen'
  return { title: 'Fokus · Notificación de prueba', body: '[PRUEBA] ' + phrase + (type === 'task' ? ' 15:00' : ' 09:00'), phrase }
})
const preferences = { timezone: 'America/Argentina/Cordoba', exam_default_time: '09:00', task_default_time: '15:00' }
afterEach(() => vi.clearAllMocks())
const Editor = ({ initial = [] }) => {
  const [phrases, setPhrases] = useState(initial)
  return <NotificationPhrasesEditor phrases={phrases} onChange={setPhrases} />
}
describe('personalización y pruebas desde preferencias', () => {
  it('muestra vista previa, cambia personalidad y envía exactamente el texto visible sin guardar preferencias', async () => {
    sendLocalNotification.mockResolvedValue(undefined)
    render(<NotificationTester phrases={[]} preferences={preferences} />)
    expect(sendLocalNotification).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Personalidad de prueba'), { target: { value: 'sarcastic' } })
    await waitFor(() => expect(screen.getByLabelText('Vista previa de notificación')).toHaveTextContent('El examen no se va a rendir solo'))
    await userEvent.click(screen.getByRole('button', { name: 'Enviar notificación de prueba' }))
    expect(sendLocalNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fokus · Notificación de prueba', body: expect.stringContaining('El examen no se va a rendir solo') }))
    expect(await screen.findByRole('status')).toHaveTextContent('Prueba enviada')
    await userEvent.click(screen.getByRole('button', { name: 'Ver otra frase' }))
    await waitFor(() => expect(screen.getByLabelText('Vista previa de notificación')).toHaveTextContent('Tu yo del futuro'))
    expect(createNotificationPhrase).not.toHaveBeenCalled()
  })
  it('exige consentimiento de prueba independiente y mantiene la vista previa cuando falla el envío', async () => {
    sendLocalNotification.mockRejectedValue(new Error('Las notificaciones están bloqueadas'))
    render(<NotificationTester phrases={[]} preferences={preferences} />)
    fireEvent.change(screen.getByLabelText('Personalidad de prueba'), { target: { value: 'unfiltered' } })
    expect(screen.getByRole('button', { name: 'Enviar notificación de prueba' })).toBeDisabled()
    await userEvent.click(screen.getByLabelText('Acepto lenguaje fuerte para esta prueba'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar notificación de prueba' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Enviar notificación de prueba' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('bloqueadas')
    expect(screen.getByLabelText('Vista previa de notificación')).toHaveTextContent('Dejá de boludear')
  })
  it('separa frases y horarios por tipo; el tipo vacío conserva la vista previa de error', async () => {
    render(<NotificationTester phrases={[{ id: 1, event_type: 'task', content: 'Mi entrega personalizada' }]} preferences={preferences} />)
    fireEvent.change(screen.getByLabelText('Personalidad de prueba'), { target: { value: 'custom' } })
    expect(screen.getByRole('button', { name: 'Enviar notificación de prueba' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Evento de prueba'), { target: { value: 'task' } })
    await waitFor(() => expect(screen.getByLabelText('Vista previa de notificación')).toHaveTextContent('Mi entrega personalizada'))
    expect(screen.getByLabelText('Vista previa de notificación')).toHaveTextContent('15:00')
  })
  it('crea, edita y elimina frases después de confirmarlas en la API', async () => {
    createNotificationPhrase.mockResolvedValue({ id: 1, event_type: 'exam', content: 'Repasá' })
    updateNotificationPhrase.mockResolvedValue({ id: 1, event_type: 'exam', content: 'Estudiá' })
    deleteNotificationPhrase.mockResolvedValue(null)
    render(<Editor />)
    await userEvent.type(screen.getByLabelText('Tu frase'), 'Repasá')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar frase' }))
    expect(await screen.findByRole('button', { name: 'Editar frase: Repasá' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Editar frase: Repasá' }))
    fireEvent.change(screen.getByLabelText('Tu frase'), { target: { value: 'Estudiá' } })
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios de frase' }))
    expect(await screen.findByRole('button', { name: 'Eliminar frase: Estudiá' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar frase: Estudiá' }))
    expect(await screen.findByText('0 de 10 frases guardadas entre exámenes y entregas')).toBeInTheDocument()
  })
  it('respeta límite total y conserva frases existentes cuando falla una operación', async () => {
    const initial = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, event_type: i % 2 ? 'task' : 'exam', content: 'Frase ' + i }))
    deleteNotificationPhrase.mockRejectedValue(new Error('No pudimos eliminar'))
    render(<Editor initial={initial} />)
    expect(screen.getByRole('button', { name: 'Agregar frase' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar frase: Frase 0' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos eliminar')
    expect(screen.getByRole('button', { name: 'Editar frase: Frase 0' })).toBeInTheDocument()
  })
})

describe('prueba Web Push desde Express', () => {
  it('requiere destino propio y envía exactamente la frase de la vista previa', async () => {
    sendPushTest.mockResolvedValue({ message: 'El servicio Push aceptó la prueba.' })
    const props = { phrases: [], preferences }
    const { rerender } = render(<NotificationTester {...props} />)
    expect(screen.getByRole('button', { name: 'Enviar prueba desde Express' })).toBeDisabled()
    rerender(<NotificationTester {...props} pushSubscriptionId={12} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar prueba desde Express' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Enviar prueba desde Express' }))
    expect(sendPushTest).toHaveBeenCalledWith(12, { event_type: 'exam', style: 'formal', unfiltered_consent: false, selected_phrase: 'Le recordamos su próximo examen' })
    expect(sendLocalNotification).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('aceptó la prueba')
  })
  it('informa vencimientos sin perder la vista previa ni modificar preferencias', async () => {
    const onPushExpired = vi.fn()
    sendPushTest.mockRejectedValue(Object.assign(new Error('La suscripción venció'), { status: 410 }))
    render(<NotificationTester phrases={[]} preferences={preferences} pushSubscriptionId={12} onPushExpired={onPushExpired} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar prueba desde Express' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Enviar prueba desde Express' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('venció')
    expect(onPushExpired).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Vista previa de notificación')).toHaveTextContent('Le recordamos')
    expect(createNotificationPhrase).not.toHaveBeenCalled()
  })
})
