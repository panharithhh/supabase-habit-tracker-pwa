// Renders every app icon from one SVG design into public/.
// Run after changing the design: node scripts/generate-icons.mjs
//
//   pwa-<n>x<n>.png           purpose "any": rounded square, transparent corners
//   maskable-icon-<n>x<n>.png purpose "maskable": full bleed, mark inside the 80% safe zone
//   apple-touch-icon-180x180.png  iOS home screen: full bleed, no transparency (iOS rounds it)
//   favicon.svg, favicon.ico  browser tab (16 + 32 px inside the .ico)
import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const GREEN = '#2f7d4f'
const OUT = new URL('../public/', import.meta.url)

// A check mark with a row of seven days under it, drawn on a 512 grid.
// `scale` shrinks the mark about the centre, to fit a mask's safe zone.
function svg({ rounded, scale = 1 }) {
  const mark = `
    <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
      <path d="M150 238 L222 310 L364 168" fill="none" stroke="#fff" stroke-width="52"
            stroke-linecap="round" stroke-linejoin="round"/>
      ${[0, 1, 2, 3, 4, 5, 6]
        .map((i) => `<circle cx="${148 + i * 36}" cy="380" r="12" fill="#fff" opacity="${i < 5 ? 1 : 0.45}"/>`)
        .join('')}
    </g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="${GREEN}"/>${mark}
  </svg>`
}

const any = svg({ rounded: true })
const fullBleed = svg({ rounded: false, scale: 0.72 })
const apple = svg({ rounded: false, scale: 0.86 })

const png = (source, size) => sharp(Buffer.from(source), { density: 300 }).resize(size, size).png().toBuffer()

async function save(name, data) {
  await writeFile(new URL(name, OUT), data)
  console.log('wrote public/' + name)
}

// The "any" set: Android launcher densities (48–192), the splash screen (512)
// and the sizes Chrome and Edge pick from for install dialogs and shortcuts.
for (const size of [48, 64, 72, 96, 128, 144, 152, 192, 256, 384, 512]) {
  await save(`pwa-${size}x${size}.png`, await png(any, size))
}
for (const size of [192, 512]) {
  await save(`maskable-icon-${size}x${size}.png`, await png(fullBleed, size))
}
await save('apple-touch-icon-180x180.png', await png(apple, 180))
await save('favicon.svg', any.replace(/\s+/g, ' ').trim() + '\n')

// An .ico is a small directory of images; modern browsers accept PNG entries.
const icoSizes = [16, 32]
const images = await Promise.all(icoSizes.map((s) => png(any, s)))
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(images.length, 4)
let offset = 6 + 16 * images.length
const entries = images.map((img, i) => {
  const e = Buffer.alloc(16)
  e.writeUInt8(icoSizes[i], 0) // width
  e.writeUInt8(icoSizes[i], 1) // height
  e.writeUInt16LE(1, 4) // colour planes
  e.writeUInt16LE(32, 6) // bits per pixel
  e.writeUInt32LE(img.length, 8)
  e.writeUInt32LE(offset, 12)
  offset += img.length
  return e
})
await save('favicon.ico', Buffer.concat([header, ...entries, ...images]))
