import { describe, expect, it } from 'vitest'
import { niceFps, readVideoInfo } from './mp4'

// Builds minimal MP4 boxes.
const enc = (s: string) => Array.from(s, (c) => c.charCodeAt(0))
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const box = (t: string, ...payload: number[][]) => {
  const body = payload.flat()
  return [...be32(body.length + 8), ...enc(t), ...body]
}
function movie({ timescale, samples, handler = 'vide' }: { timescale: number; samples: [number, number][]; handler?: string }) {
  const mdhd = box('mdhd', [0, 0, 0, 0], be32(0), be32(0), be32(timescale), be32(0), [0, 0, 0, 0])
  const hdlr = box('hdlr', [0, 0, 0, 0], be32(0), enc(handler), new Array(12).fill(0), [0])
  const stts = box('stts', [0, 0, 0, 0], be32(samples.length), ...samples.map(([n, d]) => [...be32(n), ...be32(d)]))
  return box('trak', box('mdia', mdhd, hdlr, box('minf', box('stbl', stts))))
}
const reader = (bytes: number[]) => async (o: number, l: number) => new Uint8Array(bytes.slice(o, o + l))

describe('reading the real frame rate', () => {
  it('iPhone Slo-mo original: 240 fps, index after the video data', async () => {
    // Apple uses timescale 600; 240 fps = delta 2.5 → stored as 5 at 1200.
    const bytes = [...box('ftyp', enc('qt  ')), ...box('mdat', new Array(5000).fill(7)), ...box('moov', movie({ timescale: 600, samples: [[0, 0]], handler: 'soun' }), movie({ timescale: 2400, samples: [[480, 10]] }))]
    const info = await readVideoInfo(reader(bytes), bytes.length)
    expect(info).toEqual({ fps: 240, frames: 480, seconds: 2 })
  })

  it('a shared/re-encoded clip: 29.97 fps rounds to 30', async () => {
    const bytes = [...box('ftyp', enc('mp42')), ...box('moov', movie({ timescale: 30000, samples: [[300, 1001]] }))]
    const info = await readVideoInfo(reader(bytes), bytes.length)
    expect(niceFps(info!.fps)).toBe(30)
  })

  it('returns null when there is no video track', async () => {
    const bytes = [...box('ftyp', enc('mp42')), ...box('moov', movie({ timescale: 600, samples: [[10, 20]], handler: 'soun' }))]
    expect(await readVideoInfo(reader(bytes), bytes.length)).toBeNull()
  })
})
