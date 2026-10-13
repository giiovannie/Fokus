import { afterEach, expect, it, vi } from 'vitest'
import { getCalendar, saveAgendaEvent, deleteAgendaEvent } from './calendar.service.js'
afterEach(() => vi.unstubAllGlobals())
it('consulta un rango y ejecuta CRUD por la API sin incluir identidad de usuario', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 1 }) })
  vi.stubGlobal('fetch', fetch)
  const signal = new AbortController().signal
  await getCalendar('2026-10-12', '2026-10-18', true, signal)
  const values = { title: 'Consulta', kind: 'personal', event_date: '2026-10-13', event_time: null, subject_id: null, reminder_minutes: null }
  await saveAgendaEvent(values); await saveAgendaEvent(values, 1); await deleteAgendaEvent(1)
  expect(fetch.mock.calls[0]).toEqual([expect.stringContaining('/calendar?from=2026-10-12&to=2026-10-18&custom_only=true'), expect.objectContaining({ signal })])
  expect(fetch.mock.calls.slice(1).map(([url, options]) => [url, options.method])).toEqual([[expect.stringContaining('/calendar/events'), 'POST'], [expect.stringContaining('/calendar/events/1'), 'PUT'], [expect.stringContaining('/calendar/events/1'), 'DELETE']])
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(values)
})
