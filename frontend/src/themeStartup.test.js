// @vitest-environment node
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
it.each(['dark', 'light', null, 'invalid'])('aplica %s antes de cargar React', saved => {
  const root = { style: {}, setAttribute(name, value) { this[name] = value } }
  runInNewContext(script, { document: { documentElement: root }, localStorage: { getItem: () => saved } })
  expect(root['data-bs-theme']).toBe(saved === 'dark' ? 'dark' : 'light')
  expect(root.style.colorScheme).toBe(root['data-bs-theme'])
  expect(html.indexOf(script)).toBeLessThan(html.indexOf('/src/main.jsx'))
})
it('inicia en claro si localStorage es inaccesible', () => {
  const root = { style: {}, setAttribute(name, value) { this[name] = value } }
  runInNewContext(script, { document: { documentElement: root }, localStorage: { getItem() { throw new Error('blocked') } } })
  expect(root['data-bs-theme']).toBe('light')
})
