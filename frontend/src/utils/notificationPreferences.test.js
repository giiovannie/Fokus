import { describe, expect, it } from 'vitest'
import { preferencesPayload, reminderError } from './notificationPreferences.js'
describe('notification configuration validation', () => {
  it.each([{ amount: '31', unit: 'days' }, { amount: '43201', unit: 'minutes' }, { amount: '1.5', unit: 'days' }, { amount: '', unit: 'hours' }, { amount: '-1', unit: 'minutes' }])('rejects invalid duration %j', draft => expect(reminderError(draft, [])).toBeTruthy())
  it('accepts the exact 30-day limit across units', () => {
    for (const [amount, unit] of [[30, 'days'], [720, 'hours'], [43200, 'minutes']]) expect(reminderError({ amount, unit }, [])).toBeNull()
  })
  it('rejects equivalent duplicates and a sixth rule', () => {
    expect(reminderError({ amount: 24, unit: 'hours' }, [{ id: 1, offset_minutes: 1440 }])).toBeTruthy()
    expect(reminderError({ amount: 1, unit: 'minutes' }, Array.from({ length: 5 }, (_, id) => ({ id, offset_minutes: id * 60 })))).toBeTruthy()
  })
  it('clears disabled silence and excludes server metadata', () => {
    const payload = preferencesPayload({ quiet_hours_enabled: false, quiet_start: '22:00', quiet_end: '07:00', revision: 9, user_id: 10, unfiltered_consented_at: 'server' })
    expect(payload.quiet_start).toBeNull(); expect(payload.quiet_end).toBeNull()
    expect(payload).not.toHaveProperty('revision'); expect(payload).not.toHaveProperty('user_id'); expect(payload).not.toHaveProperty('unfiltered_consented_at')
  })
})
