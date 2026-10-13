import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readRouletteExclusions, persistRouletteExclusions } from './rouletteExclusions.js'
beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())
it('guarda únicamente IDs excluidos y mantiene cuentas separadas', () => {
  persistRouletteExclusions(7, new Set(['subject:2', 'subject:1', 'task:123456']))
  expect(JSON.parse(localStorage.getItem('fokus:roulette-excluded:7'))).toEqual([1, 2])
  expect([...readRouletteExclusions(7)]).toEqual(['subject:1', 'subject:2'])
  expect(readRouletteExclusions(8).size).toBe(0)
  persistRouletteExclusions(8, new Set(['subject:4']))
  expect([...readRouletteExclusions(7)]).toEqual(['subject:1', 'subject:2'])
})
it.each(['broken', '{}', '[null,-1,1.5,"2"]'])('ignora datos inválidos %s', value => {
  localStorage.setItem('fokus:roulette-excluded:7', value)
  expect(readRouletteExclusions(7).size).toBe(0)
})
it('no persiste identidades anónimas y tolera almacenamiento bloqueado', () => {
  expect(persistRouletteExclusions(undefined, new Set(['subject:1']))).toBe(false)
  expect(localStorage.length).toBe(0)
  const blocked = { getItem: () => { throw new Error('Denied') }, setItem: () => { throw new Error('Quota') } }
  expect(readRouletteExclusions(7, blocked).size).toBe(0)
  expect(persistRouletteExclusions(7, new Set(), blocked)).toBe(false)
})
