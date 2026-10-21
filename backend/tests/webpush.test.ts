import ece from 'http_ece'
import { createECDH, createPublicKey, randomBytes, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { fromB64url, toB64url } from '../src/b64'
import { buildPushRequest, encryptPayload, generateVapidKeys, vapidAuthorization } from '../src/webpush'

function fakeBrowserSubscription() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const auth = randomBytes(16)
  return {
    ecdh,
    auth,
    sub: { endpoint: 'https://web.push.apple.com/QGabc123', p256dh: ecdh.getPublicKey('base64url'), auth: auth.toString('base64url') },
  }
}

describe('base64url', () => {
  it('round-trips every length', () => {
    for (let n = 0; n < 70; n++) {
      const b = new Uint8Array(randomBytes(n))
      expect(toB64url(b)).toBe(Buffer.from(b).toString('base64url'))
      expect(Buffer.from(fromB64url(toB64url(b)))).toEqual(Buffer.from(b))
    }
  })
})

describe('payload encryption (RFC 8291)', () => {
  it('decrypts with an independent implementation', () => {
    const { ecdh, auth, sub } = fakeBrowserSubscription()
    const msg = JSON.stringify({ title: 'Family Trainer', body: 'You’re 40 g short. 💪' })
    const body = encryptPayload(new TextEncoder().encode(msg), sub)
    const plain = ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: ecdh, dh: undefined, authSecret: auth })
    expect(plain.toString('utf8')).toBe(msg)
  })
})

describe('VAPID (RFC 8292)', () => {
  it('signs a JWT that verifies against the public key', () => {
    const keys = generateVapidKeys()
    const header = vapidAuthorization('https://web.push.apple.com/QGabc', keys, 'mailto:me@example.com', 1_800_000_000)
    const [, jwt, k] = header.match(/^vapid t=([^,]+), k=(.+)$/)!
    expect(k).toBe(keys.publicKey)
    const [h, c, s] = jwt.split('.')
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toEqual({
      aud: 'https://web.push.apple.com',
      exp: 1_800_000_000 + 43200,
      sub: 'mailto:me@example.com',
    })
    const pub = Buffer.from(fromB64url(keys.publicKey))
    const jwk = { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }
    const ok = verify('sha256', Buffer.from(`${h}.${c}`), { key: createPublicKey({ key: jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'))
    expect(ok).toBe(true)
  })

  it('builds the full request', () => {
    const { sub } = fakeBrowserSubscription()
    const req = buildPushRequest(sub, { title: 't' }, generateVapidKeys(), 'mailto:x@example.com')
    expect(req.headers['Content-Encoding']).toBe('aes128gcm')
    expect(req.body.length).toBeGreaterThan(86)
  })
})
