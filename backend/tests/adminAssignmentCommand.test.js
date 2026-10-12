import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, it, vi } from 'vitest'
const script = fileURLToPath(new URL('../scripts/grant-superadmin.js', import.meta.url))
it.each([[[]], [['--user-id', '8', '--confirm', '--identity-verified']]])('el ejecutor administrativo no conecta ni asigna sin terminal interactiva: %j', args => {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 5000, env: { NODE_ENV: 'production' } })
  expect(result.status).toBe(1)
  expect(result.stdout).toBe('')
  expect(JSON.parse(result.stderr)).toEqual({stage:'arguments',code:'CONFIRMATION_OR_TERMINAL_REQUIRED'})
  expect(result.stderr).not.toMatch(/mysql|password|Bearer|Error:/)
})

import { formatGrantError, verifyAssignedRole } from '../scripts/grant-superadmin.js'
it.each(['ECONNREFUSED','ER_ACCESS_DENIED_ERROR','ER_TABLEACCESS_DENIED_ERROR','ERR_TLS_CERT_ALTNAME_INVALID'])('diagnóstico seguro %s', code => {
  expect(JSON.parse(formatGrantError({original:{code,message:'secret',sql:'secret'}},'connection'))).toEqual({stage:'connection',code})
})
it('solo expone nombres de variables permitidos', () => {
 expect(JSON.parse(formatGrantError({name:'EnvironmentError',message:'Configuración inválida: JWT_SECRET'},'configuration')).code).toBe('INVALID_JWT_SECRET')
 expect(formatGrantError({name:'EnvironmentError',message:'secret'},'configuration')).not.toContain('secret')
})

it('verifica exclusivamente el ID esperado después de asignar', async () => {
 const User = { findByPk: vi.fn().mockResolvedValue({id:4,email:'approved@example.com',role:'superadmin'}) }
 await verifyAssignedRole(User,4,'approved@example.com')
 expect(User.findByPk).toHaveBeenCalledWith(4,{attributes:['id','email','role']})
})
it.each([null,{id:4,email:'approved@example.com',role:'student'},{id:5,email:'approved@example.com',role:'superadmin'},{id:4,email:'other@example.com',role:'superadmin'}])('rechaza verificación posterior incorrecta', async result => {
 await expect(verifyAssignedRole({findByPk:vi.fn().mockResolvedValue(result)},4,'approved@example.com')).rejects.toThrow()
})
