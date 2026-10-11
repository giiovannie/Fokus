import { afterEach, describe, expect, it, vi } from 'vitest'
import { Op } from 'sequelize'
import { getNotifications } from '../src/controllers/notification.controller.js'
import { Exam, Task, StudyActivity, Subject, NotificationPreference, NotificationPhrase } from '../src/models/index.js'

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('upcoming notifications', () => {
  it.each(['2026-10-11T12:00:00Z', '2026-10-12T01:30:00Z'])('includes tomorrow DATEONLY events with nullable times at %s', async (now) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(now))
    const exam = vi.spyOn(Exam, 'findAll').mockResolvedValue([{ title: 'Parcial', exam_date: '2026-10-12', exam_time: null, subject: { name: 'Matemática' } }])
    const task = vi.spyOn(Task, 'findAll').mockResolvedValue([{ title: 'Entrega', due_date: '2026-10-12', due_time: null, subject: { name: 'Matemática' } }])
    vi.spyOn(StudyActivity, 'findAll').mockResolvedValue([])
    const preferences = vi.spyOn(NotificationPreference, 'findOne').mockResolvedValue(null)
    const res = { json: vi.fn() }
    const next = vi.fn()
    await getNotifications({ user: { id: 7 } }, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ type: 'exam', message: expect.stringContaining('Parcial') }),
      expect.objectContaining({ type: 'task', message: expect.stringContaining('Entrega') }),
    ]))
    for (const query of [exam, task]) {
      const options = query.mock.calls[0][0]
      expect(options.include).toEqual([{ model: Subject, as: 'subject', where: { user_id: 7 }, attributes: ['name'] }])
      const range = (options.where.exam_date ?? options.where.due_date)[Op.between]
      expect(range[0] <= '2026-10-12' && range[1] >= '2026-10-12').toBe(true)
    }
    expect(task.mock.calls[0][0].where.status[Op.ne]).toBe('completed')
    expect(preferences).toHaveBeenCalledWith({ where: { user_id: 7 } })
  })
  it('personaliza eventos aunque Push esté desactivado y agrega datos confiables', async () => {
    vi.spyOn(NotificationPreference, 'findOne').mockResolvedValue({ exam_style: 'custom', task_style: 'friendly', enabled: false, exam_default_time: '09:00', task_default_time: '15:00' })
    vi.spyOn(NotificationPhrase, 'findAll').mockResolvedValue([{ event_type: 'exam', content: 'Mi frase' }])
    vi.spyOn(Exam, 'findAll').mockResolvedValue([{ id: 1, title: 'Parcial', exam_date: '2026-10-12', exam_time: '10:30:00', subject: { name: 'Matemática' } }])
    vi.spyOn(Task, 'findAll').mockResolvedValue([{ id: 1, title: 'Guía', due_date: '2026-10-12', due_time: null, subject: { name: 'Historia' } }])
    vi.spyOn(StudyActivity, 'findAll').mockResolvedValue([])
    const res = { json: vi.fn() }, next = vi.fn()
    await getNotifications({ user: { id: 7 } }, res, next)
    expect(next).not.toHaveBeenCalled()
    const result = res.json.mock.calls[0][0]
    expect(result.find(item => item.type === 'exam').message).toContain('Mi frase')
    expect(result.find(item => item.type === 'exam').message).toContain('10:30')
    expect(result.find(item => item.type === 'task').message).toContain('15:00')
    expect(result.find(item => item.type === 'task').message).not.toContain('Mi frase')
    expect(NotificationPhrase.findAll).toHaveBeenCalledWith({ where: { user_id: 7 } })
  })

})
