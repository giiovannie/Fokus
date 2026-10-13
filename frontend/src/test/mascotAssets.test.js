// @vitest-environment node
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { readFile, stat } from 'node:fs/promises'
import { expect, it } from 'vitest'
const sharp = createRequire(resolve('../backend/package.json'))('sharp')
const root = resolve('public/mascotas')
const filePath = name => resolve(root, name)
it.each(['mirada-fija', 'graduado', 'lentes', 'saludando'])('carga ambas resoluciones transparentes de %s y respeta sus proporciones', async name => {
  for (const size of [160, 320]) {
    const path = filePath(`buho-${name}-${size}.webp`)
    const metadata = await sharp(path).metadata()
    expect(metadata).toMatchObject({ width: size, height: size, format: 'webp', hasAlpha: true })
    expect((await stat(path)).size).toBeLessThan(30000)
    const { data } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    expect(data[3]).toBe(0) // No queda un rectángulo blanco sobre el tema oscuro.
    for (const color of ['#F8FAFC', '#101827']) {
      const composed = await sharp(path).flatten({ background: color }).raw().toBuffer()
      expect([...composed.subarray(0, 3)]).toEqual(color.match(/\w{2}/g).map(value => parseInt(value, 16)))
    }
  }
})
it('mantiene originales y recursos antiguos y valida los iconos Android del manifiesto', async () => {
  for (const name of ['recibido', 'lentes', 'saludando', 'mirada-fija']) expect((await sharp(filePath('originales/imagen-buho-' + name + '.jpg')).metadata()).format).toBe('jpeg')
  const manifest = JSON.parse(await readFile(resolve('public/manifest.webmanifest'), 'utf8'))
  for (const icon of manifest.icons) {
    expect(icon.purpose).toBe('any maskable')
    const size = Number(icon.sizes.split('x')[0]); const metadata = await sharp(resolve('public' + icon.src)).metadata()
    expect(metadata).toMatchObject({ width: size, height: size, format: 'png' })
  }
  expect((await stat(resolve('public/icons/fokus-logo.png'))).size).toBeGreaterThan(0)
})
