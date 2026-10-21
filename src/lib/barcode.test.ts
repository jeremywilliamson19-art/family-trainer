import { describe, expect, it } from 'vitest'
import { decodeRgba, normalizeBarcode } from './barcode'

// Renders an EAN-13 barcode (standard L/G/R encodings) into RGBA pixels.
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

function ean13Modules(code: string): string {
  const d = code.split('').map(Number)
  let bits = '101'
  for (let i = 1; i <= 6; i++) bits += (PARITY[d[0]][i - 1] === 'L' ? L : G)[d[i]]
  bits += '01010'
  for (let i = 7; i <= 12; i++) bits += R[d[i]]
  return bits + '101'
}

// Seeded noise so the test is the same every run (mulberry32).
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function render(code: string, { module = 3, quiet = 12, height = 80, rotate = false, noise = 0 } = {}) {
  const rand = rng(42)
  const bits = ean13Modules(code)
  const w0 = (bits.length + quiet * 2) * module
  const [w, h] = rotate ? [height, w0] : [w0, height]
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const along = rotate ? y : x
      const m = Math.floor(along / module) - quiet
      let v = m >= 0 && m < bits.length && bits[m] === '1' ? 20 : 235
      v = Math.max(0, Math.min(255, v + (rand() - 0.5) * noise))
      const i = (y * w + x) * 4
      data[i] = data[i + 1] = data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return { data, w, h }
}

describe('barcode decoding', () => {
  it('reads a clean EAN-13 (fairlife Core Power)', () => {
    const { data, w, h } = render('0049000028911')
    expect(decodeRgba(data, w, h)).toBe('0049000028911')
  })

  it('reads a noisy barcode', () => {
    const { data, w, h } = render('5000159407236', { noise: 60, module: 4 })
    expect(decodeRgba(data, w, h)).toBe('5000159407236')
  })

  it('reads a sideways barcode (phone held vertically)', () => {
    const { data, w, h } = render('5000159407236', { rotate: true, module: 4 })
    expect(decodeRgba(data, w, h)).toBe('5000159407236')
  })

  it('reads a leading-zero code as the 13-digit form Open Food Facts uses, even sideways', () => {
    const { data, w, h } = render('0049000028911', { rotate: true })
    expect(decodeRgba(data, w, h)).toBe('0049000028911')
  })

  it('normalizes UPC-A and UPC-E, leaves EAN-8 alone', () => {
    expect(normalizeBarcode('049000028911')).toBe('0049000028911')
    expect(normalizeBarcode('04252614')).toBe('0042100005264') // UPC-E → UPC-A 042100005264
    expect(normalizeBarcode('96385074')).toBe('96385074') // EAN-8
  })

  it('returns null for an image with no barcode', () => {
    const data = new Uint8ClampedArray(200 * 100 * 4).fill(128)
    expect(decodeRgba(data, 200, 100)).toBeNull()
  })
})
