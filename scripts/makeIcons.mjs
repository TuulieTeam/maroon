// One-off PWA icon generator: a 16x16 pixel-art gold "M" on maroon, scaled nearest-neighbour to
// 192/512 (and a 180 apple-touch). Zero dependencies — raw PNG encoding via node:zlib.
// Run: node scripts/makeIcons.mjs   (outputs into public/)
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const MAROON = [0x6a, 0x0f, 0x2b]
const DEEP = [0x4a, 0x0a, 0x1e]
const GOLD = [0xf4, 0xc4, 0x30]

// 16x16 grid: . = maroon field, # = gold M, o = deep border.
const ART = [
  'oooooooooooooooo',
  'o..............o',
  'o..............o',
  'o..##......##..o',
  'o..###....###..o',
  'o..####..####..o',
  'o..##.####.##..o',
  'o..##..##..##..o',
  'o..##......##..o',
  'o..##......##..o',
  'o..##......##..o',
  'o..##......##..o',
  'o..##......##..o',
  'o..............o',
  'o..............o',
  'oooooooooooooooo',
]

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size) {
  const scale = size / 16
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = [0] // filter byte
    const artRow = ART[Math.floor(y / scale)]
    for (let x = 0; x < size; x++) {
      const ch = artRow[Math.floor(x / scale)]
      const [r, g, b] = ch === '#' ? GOLD : ch === 'o' ? DEEP : MAROON
      row.push(r, g, b)
    }
    rows.push(Buffer.from(row))
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public', { recursive: true })
for (const size of [192, 512, 180]) {
  const name = size === 180 ? 'public/apple-touch-icon.png' : `public/pwa-${size}.png`
  writeFileSync(name, png(size))
  console.log(`wrote ${name}`)
}
