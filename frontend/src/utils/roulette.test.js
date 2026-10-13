import { describe, expect, it, vi } from 'vitest'
import { buildRouletteOptions, nextRouletteComment, randomIndex, rouletteComments, winningRotation } from './roulette.js'

describe('selección justa de actividades', () => {
  it('rechaza el sobrante de 32 bits en lugar de favorecer una opción', () => {
    const draw = vi.fn().mockReturnValueOnce(2 ** 32 - 1).mockReturnValueOnce(2)
    expect(randomIndex(3, draw)).toBe(2)
    expect(draw).toHaveBeenCalledTimes(2)
  })
  it.each([1, 2, 3, 7, 17, 100])('da el mismo número de resultados a cada índice de %i opciones', length => {
    const counts = Array(length).fill(0)
    for (let value = 0; value < length * 8; value++) counts[randomIndex(length, () => value)]++
    expect(counts.every(count => count === 8)).toBe(true)
  })
  it.each([0, -1, 1.5, NaN, 2 ** 32 + 1])('rechaza un total inválido: %s', length => {
    expect(() => randomIndex(length)).toThrow(RangeError)
  })
  it('no duplica tareas y exámenes por sus referencias a materias y conserva identidades distintas', () => {
    const task = { id: 1, title: 'Entrega', status: 'pending', subject_id: 1 }
    const exam = { id: 1, title: 'Parcial', subject_id: 1 }
    const data = { subjects: [{ id: 1, name: 'Programación', tasks: [task], exams: [exam] }], tasks: [task, { ...task, id: 2, status: 'completed' }], exams: [exam] }
    const before = structuredClone(data)
    const options = buildRouletteOptions(data)
    expect(options.map(option => option.key)).toEqual(['subject:1', 'task:1', 'exam:1'])
    expect(options[1]).toMatchObject({ subject: 'Programación', href: '/tasks#task-1' })
    expect(buildRouletteOptions(data, true)).toHaveLength(4)
    expect(data).toEqual(before)
  })
  it('no restaura un duplicado pendiente de una tarea completada en la lista principal', () => {
    expect(buildRouletteOptions({ subjects: [{ id: 1, name: 'Materia', tasks: [{ id: 3, title: 'Tarea', status: 'pending' }] }], tasks: [{ id: 3, title: 'Tarea', status: 'completed' }] }).map(option => option.key)).toEqual(['subject:1'])
    expect(buildRouletteOptions({})).toEqual([])
  })
  it.each([1, 2, 3, 8, 37])('termina cada sector de %i opciones exactamente bajo la flecha, incluso después de otros giros', count => {
    let previous = 127
    for (let index = 0; index < count; index++) {
      const rotation = winningRotation(previous, index, count)
      expect(rotation - previous).toBeGreaterThanOrEqual(6 * 360)
      const center = (index + 0.5) * 360 / count
      const aligned = (rotation + center) % 360
      expect(Math.min(aligned, 360 - aligned)).toBeLessThan(0.000001)
      previous = rotation
    }
  })
  it.each(Object.keys(rouletteComments))('no repite una frase consecutiva en la etapa %s', phase => {
    let previous = ''
    for (let i = 0; i < 10; i++) {
      const text = nextRouletteComment(phase, previous, 'Programación II', () => 0)
      expect(text).not.toBe(previous)
      expect(text).not.toContain('{actividad}')
      previous = text
    }
  })
})
