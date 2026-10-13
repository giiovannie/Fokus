// Optimización reproducible de los PNG transparentes ya revisados; no genera mascotas.
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
const require = createRequire(new URL('../../backend/package.json', import.meta.url))
const sharp = require('sharp')
const root = new URL('../public/mascotas/', import.meta.url)
await mkdir(root, { recursive: true })
for (const name of ['mirada-fija', 'graduado', 'lentes', 'saludando']) {
  const source = new URL(`buho-${name}.png`, root)
  for (const size of [160, 320]) await sharp(source.pathname.replace(/^\/(\w:)/, '$1')).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 85, alphaQuality: 100 }).toFile(new URL(`buho-${name}-${size}.webp`, root).pathname.replace(/^\/(\w:)/, '$1'))
}
for (const size of [192, 512]) {
  const content = await sharp(new URL('buho-mirada-fija.png', root).pathname.replace(/^\/(\w:)/, '$1')).resize(Math.round(size * .7), Math.round(size * .7), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: '#0F766E' } }).composite([{ input: content, gravity: 'center' }]).png().toFile(new URL(`fokus-${size}-v2.png`, root).pathname.replace(/^\/(\w:)/, '$1'))
}
