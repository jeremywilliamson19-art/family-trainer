// Reads a video's real frame rate from its MP4/MOV index (moov → video
// trak → mdhd timescale/duration + stts sample counts). Reads only box
// headers until the index, so a 300 MB clip isn't loaded into memory.

export type ReadAt = (offset: number, length: number) => Promise<Uint8Array>

export interface VideoInfo {
  fps: number
  frames: number
  seconds: number
}


function u32(b: Uint8Array, o: number) {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0
}
function u64(b: Uint8Array, o: number) {
  return u32(b, o) * 2 ** 32 + u32(b, o + 4)
}
function type(b: Uint8Array, o: number) {
  return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3])
}

interface Box {
  type: string
  start: number // offset of the payload within `b`
  end: number
}

function children(b: Uint8Array, start: number, end: number): Box[] {
  const out: Box[] = []
  let o = start
  while (o + 8 <= end) {
    let size = u32(b, o)
    const t = type(b, o + 4)
    let header = 8
    if (size === 1) {
      size = u64(b, o + 8)
      header = 16
    } else if (size === 0) size = end - o
    if (size < header) break
    out.push({ type: t, start: o + header, end: Math.min(end, o + size) })
    o += size
  }
  return out
}

function find(b: Uint8Array, box: Box, path: string[]): Box | null {
  let cur: Box | null = box
  for (const p of path) {
    cur = cur ? (children(b, cur.start, cur.end).find((c) => c.type === p) ?? null) : null
  }
  return cur
}

/** Parses a moov box payload. */
export function parseMoov(b: Uint8Array): VideoInfo | null {
  const moov: Box = { type: 'moov', start: 0, end: b.length }
  for (const trak of children(b, moov.start, moov.end).filter((c) => c.type === 'trak')) {
    const hdlr = find(b, trak, ['mdia', 'hdlr'])
    if (!hdlr || type(b, hdlr.start + 8) !== 'vide') continue
    const mdhd = find(b, trak, ['mdia', 'mdhd'])
    const stts = find(b, trak, ['mdia', 'minf', 'stbl', 'stts'])
    if (!mdhd || !stts) continue
    const v1 = b[mdhd.start] === 1
    const timescale = u32(b, mdhd.start + (v1 ? 20 : 12))
    const count = u32(b, stts.start + 4)
    let frames = 0
    let ticks = 0
    for (let i = 0; i < count; i++) {
      const n = u32(b, stts.start + 8 + i * 8)
      const delta = u32(b, stts.start + 12 + i * 8)
      frames += n
      ticks += n * delta
    }
    if (!timescale || !ticks) continue
    const seconds = ticks / timescale
    return { fps: frames / seconds, frames, seconds }
  }
  return null
}

/** Walks top-level boxes to find moov (often at the end of iPhone files). */
export async function readVideoInfo(read: ReadAt, size: number): Promise<VideoInfo | null> {
  let o = 0
  while (o + 8 <= size) {
    const h = await read(o, 16)
    let boxSize = u32(h, 0)
    const t = type(h, 4)
    let header = 8
    if (boxSize === 1) {
      boxSize = u64(h, 8)
      header = 16
    } else if (boxSize === 0) boxSize = size - o
    if (boxSize < header) return null
    if (t === 'moov') {
      if (boxSize > 64 * 1024 * 1024) return null
      return parseMoov(await read(o + header, boxSize - header))
    }
    o += boxSize
  }
  return null
}

export function readFileInfo(file: Blob): Promise<VideoInfo | null> {
  return readVideoInfo(async (offset, length) => new Uint8Array(await file.slice(offset, offset + length).arrayBuffer()), file.size)
}

/** Rounds to the familiar camera rates when close (29.97 → 30, 239.8 → 240). */
export function niceFps(fps: number): number {
  for (const r of [24, 25, 30, 48, 50, 60, 100, 120, 240]) if (Math.abs(fps - r) / r < 0.02) return r
  return Math.round(fps * 10) / 10
}
