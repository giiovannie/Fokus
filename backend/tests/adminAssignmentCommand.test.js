import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
const script = fileURLToPath(new URL('../scripts/grant-superadmin.js', import.meta.url))
it.each([[[]], [['--user-id', '8', '--confirm', '--identity-verified']]])('el ejecutor administrativo no conecta ni asigna sin terminal interactiva: %j', args => {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 5000, env: { NODE_ENV: 'production' } })
  expect(result.status).toBe(1)
  expect(result.stdout).toBe('')
  expect(result.stderr).toContain('No se asignó el rol.')
  expect(result.stderr).not.toMatch(/mysql|password|Bearer|Error:/)
})
