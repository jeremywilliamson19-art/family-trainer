// base64url without Buffer/atob, so it runs in Apps Script and Node alike.
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const LOOKUP: Record<string, number> = {}
for (let i = 0; i < ALPHA.length; i++) LOOKUP[ALPHA[i]] = i
LOOKUP['+'] = 62
LOOKUP['/'] = 63

export function toB64url(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += ALPHA[(n >> 18) & 63] + ALPHA[(n >> 12) & 63]
    if (i + 1 < bytes.length) out += ALPHA[(n >> 6) & 63]
    if (i + 2 < bytes.length) out += ALPHA[n & 63]
  }
  return out
}

export function fromB64url(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let bits = 0
  let acc = 0
  let j = 0
  for (const ch of clean) {
    const v = LOOKUP[ch]
    if (v === undefined) throw new Error('bad base64')
    acc = (acc << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[j++] = (acc >> bits) & 255
    }
  }
  return out
}

export const utf8 = (s: string) => new TextEncoder().encode(s)

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

export function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
