// Apps Script's V8 has no Web Crypto or TextEncoder. Provide the two pieces
// the noble libraries and our code need, built on Apps Script's Utilities.

const g = globalThis as Record<string, unknown>

if (typeof (g.crypto as Crypto | undefined)?.getRandomValues !== 'function') {
  let counter = 0
  g.crypto = {
    // Random UUIDs (SecureRandom) hashed with SHA-256 → 32 bytes per round.
    getRandomValues<T extends ArrayBufferView>(arr: T): T {
      const out = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)
      for (let o = 0; o < out.length; ) {
        const digest = Utilities.computeDigest(
          Utilities.DigestAlgorithm.SHA_256,
          Utilities.getUuid() + Utilities.getUuid() + counter++,
        )
        for (let i = 0; i < digest.length && o < out.length; i++) out[o++] = digest[i] & 255
      }
      return arr
    },
  }
}

if (typeof g.TextEncoder !== 'function') {
  class Utf8Encoder {
    readonly encoding = 'utf-8'
    encode(s = ''): Uint8Array {
      const bytes: number[] = []
      for (const ch of s) {
        const c = ch.codePointAt(0)!
        if (c < 0x80) bytes.push(c)
        else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63))
        else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
        else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
      }
      return new Uint8Array(bytes)
    }
  }
  g.TextEncoder = Utf8Encoder
}
