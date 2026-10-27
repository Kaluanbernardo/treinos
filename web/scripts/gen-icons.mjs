// Gera os ícones PNG do PWA a partir de um SVG simples (halter limão sobre #0E1116).
// Uso: npm run icons
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'

const BG = '#0E1116'
const LIME = '#C6F432'
const out = new URL('../public/icons/', import.meta.url)

// halter centrado num quadro 512×512; `scale` encolhe para caber na safe zone do maskable
const glyph = (scale) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)" fill="${LIME}">
    <rect x="96"  y="176" width="44" height="160" rx="14"/>
    <rect x="148" y="146" width="48" height="220" rx="16"/>
    <rect x="316" y="146" width="48" height="220" rx="16"/>
    <rect x="372" y="176" width="44" height="160" rx="14"/>
    <rect x="196" y="236" width="120" height="40" rx="10"/>
  </g>`

const svg = ({ radius, scale }) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="${BG}"/>${glyph(scale)}
</svg>`

await mkdir(out, { recursive: true })
const any = svg({ radius: 96, scale: 1 })
const maskable = svg({ radius: 0, scale: 0.72 }) // conteúdo dentro do círculo de 80%

await writeFile(new URL('favicon.svg', out), any)
await sharp(Buffer.from(any)).resize(192, 192).png().toFile(new URL('icon-192.png', out).pathname)
await sharp(Buffer.from(any)).resize(512, 512).png().toFile(new URL('icon-512.png', out).pathname)
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile(new URL('icon-maskable-512.png', out).pathname)
await sharp(Buffer.from(maskable)).resize(180, 180).png().toFile(new URL('apple-touch-icon.png', out).pathname)
console.log('ícones gerados em public/icons/')
