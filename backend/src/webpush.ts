// Web Push (RFC 8291 aes128gcm payload encryption + RFC 8292 VAPID) in pure
// JS, because Apps Script has no ECDH, ECDSA or AES-GCM of its own.
import { gcm } from '@noble/ciphers/aes.js'
import { p256 } from '@noble/curves/nist.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { randomBytes } from '@noble/hashes/utils.js'
import { concat, fromB64url, toB64url, utf8 } from './b64'

export interface VapidKeys {
  publicKey: string // base64url, 65-byte uncompressed point
  privateKey: string // base64url, 32 bytes
}

export interface PushSubscriptionKeys {
  endpoint: string
  p256dh: string
  auth: string
}

export function generateVapidKeys(): VapidKeys {
  const sk = p256.utils.randomSecretKey()
  return { publicKey: toB64url(p256.getPublicKey(sk, false)), privateKey: toB64url(sk) }
}

/** Encrypts one record (payload < 4 KB) for the given subscription. */
export function encryptPayload(payload: Uint8Array, sub: PushSubscriptionKeys, salt = randomBytes(16), asSecret = p256.utils.randomSecretKey()) {
  const uaPublic = fromB64url(sub.p256dh)
  const authSecret = fromB64url(sub.auth)
  const asPublic = p256.getPublicKey(asSecret, false)
  // Shared secret is the x-coordinate of the ECDH point.
  const ecdhSecret = p256.getSharedSecret(asSecret, uaPublic, true).slice(1)

  const keyInfo = concat(utf8('WebPush: info\0'), uaPublic, asPublic)
  const ikm = hkdf(sha256, ecdhSecret, authSecret, keyInfo, 32)
  const cek = hkdf(sha256, ikm, salt, utf8('Content-Encoding: aes128gcm\0'), 16)
  const nonce = hkdf(sha256, ikm, salt, utf8('Content-Encoding: nonce\0'), 12)

  // 0x02 marks the last (only) record.
  const ciphertext = gcm(cek, nonce).encrypt(concat(payload, new Uint8Array([2])))

  const rs = 4096
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length)
  header.set(salt, 0)
  header.set([(rs >>> 24) & 255, (rs >>> 16) & 255, (rs >>> 8) & 255, rs & 255], 16)
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, ciphertext)
}

/** Authorization header value for one push-service origin. */
export function vapidAuthorization(endpoint: string, keys: VapidKeys, subject: string, nowSec = Math.floor(Date.now() / 1000)) {
  const aud = endpoint.match(/^https:\/\/[^/]+/)?.[0]
  if (!aud) throw new Error('push endpoint must be https')
  const header = toB64url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = toB64url(utf8(JSON.stringify({ aud, exp: nowSec + 12 * 3600, sub: subject })))
  const signingInput = `${header}.${claims}`
  const sig = p256.sign(utf8(signingInput), fromB64url(keys.privateKey)) // SHA-256 prehash, 64-byte r||s
  return `vapid t=${signingInput}.${toB64url(sig)}, k=${keys.publicKey}`
}

/** Everything needed for the HTTP POST to the push service. */
export function buildPushRequest(sub: PushSubscriptionKeys, message: unknown, keys: VapidKeys, subject: string) {
  return {
    url: sub.endpoint,
    headers: {
      Authorization: vapidAuthorization(sub.endpoint, keys, subject),
      'Content-Encoding': 'aes128gcm',
      TTL: String(12 * 3600),
      Urgency: 'normal',
    },
    body: encryptPayload(utf8(JSON.stringify(message)), sub),
  }
}
