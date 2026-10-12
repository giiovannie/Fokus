import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { usePreferenceAutosave } from './usePreferenceAutosave.js'
import { saveNotificationPreferences } from '../services/notifications.service.js'
vi.mock('../services/notifications.service.js', () => ({ saveNotificationPreferences: vi.fn() }))
const defaults = { enabled: false, timezone: 'America/Argentina/Cordoba', exams_enabled: false, tasks_enabled: false, exam_default_time: '09:00', task_default_time: '09:00', exam_style: 'formal', task_style: 'formal', unfiltered_enabled: false, quiet_hours_enabled: false, quiet_start: null, quiet_end: null }
beforeEach(() => { vi.clearAllMocks(); saveNotificationPreferences.mockImplementation(async values => values) })
it('persiste el estilo propio pendiente al existir una frase, sin escrituras iniciales', async () => {
  const { result, rerender } = renderHook(({ phrases }) => usePreferenceAutosave(values => values.exam_style === 'custom' && !phrases.length ? 'Agregá una frase' : null, phrases), { initialProps: { phrases: [] } })
  act(() => result.current.initialize(defaults))
  expect(saveNotificationPreferences).not.toHaveBeenCalled()
  act(() => result.current.change('exam_style', 'custom'))
  expect(result.current.status.kind).toBe('invalid')
  expect(saveNotificationPreferences).not.toHaveBeenCalled()
  rerender({ phrases: [{ content: 'Repasá' }] })
  await waitFor(() => expect(result.current.status.kind).toBe('saved'))
  expect(saveNotificationPreferences).toHaveBeenCalledWith(expect.objectContaining({ exam_style: 'custom' }))
})
it('detiene la cola ante un fallo y reintenta el último borrador completo', async () => {
  let reject
  saveNotificationPreferences.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
  const { result } = renderHook(() => usePreferenceAutosave(() => null))
  act(() => result.current.initialize(defaults))
  act(() => result.current.change('enabled', true))
  act(() => result.current.change('tasks_enabled', true))
  expect(saveNotificationPreferences).toHaveBeenCalledTimes(1)
  await act(async () => reject(new Error('Offline')))
  expect(result.current.status.kind).toBe('error')
  expect(saveNotificationPreferences).toHaveBeenCalledTimes(1)
  act(() => result.current.retry())
  await waitFor(() => expect(result.current.status.kind).toBe('saved'))
  expect(saveNotificationPreferences).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true, tasks_enabled: true }))
})
