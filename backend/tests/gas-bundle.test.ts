// Runs the built backend/dist/Code.js in a bare V8 context (no crypto, no
// TextEncoder, no Buffer, like Apps Script) with fake Google services.
import ece from 'http_ece'
import { createECDH, createHash, randomBytes, randomUUID } from 'node:crypto'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { beforeAll, describe, expect, it } from 'vitest'

type Row = unknown[]

function fakeSheet(name: string) {
  const rows: Row[] = []
  const sheet = {
    name,
    rows,
    getLastRow: () => rows.length,
    getRange: (r: number, c: number, nr = 1, nc = 1) => ({
      getValues: () => rows.slice(r - 1, r - 1 + nr).map((row) => Array.from({ length: nc }, (_, i) => row[c - 1 + i] ?? '')),
      setValues: (vals: Row[]) => {
        vals.forEach((v, i) => {
          const row = (rows[r - 1 + i] ??= [])
          v.forEach((x, j) => (row[c - 1 + j] = x))
        })
        return { setFontWeight: () => {} }
      },
    }),
    appendRow: (row: Row) => rows.push([...row]),
    deleteRow: (r: number) => rows.splice(r - 1, 1),
    setFrozenRows: () => {},
  }
  return sheet
}

function makeContext() {
  const sheets = new Map<string, ReturnType<typeof fakeSheet>>([['Sheet1', fakeSheet('Sheet1')]])
  const props: Record<string, string> = {}
  const mail: { to: string; subject: string }[] = []
  const fetches: { url: string; headers: Record<string, string>; body: number[] }[] = []
  const ss = {
    getSheetByName: (n: string) => sheets.get(n) ?? null,
    insertSheet: (n: string) => (sheets.set(n, fakeSheet(n)), sheets.get(n)),
    getSheets: () => [...sheets.values()],
    getUrl: () => 'https://docs.google.com/spreadsheets/d/sheet-1',
    deleteSheet: (s: { name: string }) => sheets.delete(s.name),
  }
  const ctx = vm.createContext({
    console,
    SpreadsheetApp: { create: () => ({ getId: () => 'sheet-1' }), openById: () => ss },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props[k] ?? null,
        setProperty: (k: string, v: string) => (props[k] = v),
        setProperties: (o: Record<string, string>) => Object.assign(props, o),
        getProperties: () => ({ ...props }),
      }),
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'Jeremy@Example.com' }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    MailApp: {
      getRemainingDailyQuota: () => 100,
      sendEmail: (o: { to: string; subject: string }) => mail.push(o),
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s: string) => ({ setMimeType: () => ({ content: s }) }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      // Apps Script returns signed bytes.
      computeDigest: (_alg: string, s: string) => Array.from(createHash('sha256').update(s).digest(), (b) => (b > 127 ? b - 256 : b)),
      getUuid: () => randomUUID(),
      newBlob: (bytes: number[]) => ({ bytes }),
    },
    UrlFetchApp: {
      fetch: (url: string, o: { headers: Record<string, string>; payload: { bytes: number[] } }) => {
        fetches.push({ url, headers: o.headers, body: o.payload.bytes })
        return { getResponseCode: () => 201 }
      },
    },
  })
  return { ctx, props, mail, fetches, sheets }
}

describe('bundled Apps Script code', () => {
  let t: ReturnType<typeof makeContext>
  const post = (body: object) => {
    const out = vm.runInContext(`doPost(${JSON.stringify({ postData: { contents: JSON.stringify(body) } })})`, t.ctx)
    return JSON.parse(out.content)
  }

  beforeAll(() => {
    execSync('node backend/build.mjs', { cwd: join(__dirname, '..', '..') })
    t = makeContext()
    // Confirm the sandbox really lacks the Web APIs Apps Script lacks.
    expect(vm.runInContext('typeof crypto + typeof TextEncoder + typeof Buffer', t.ctx)).toBe('undefinedundefinedundefined')
    vm.runInContext(readFileSync(join(__dirname, '..', 'dist', 'Code.js'), 'utf8'), t.ctx)
  })

  it('setup creates every tab and push keys, and records the admin', () => {
    vm.runInContext('setup()', t.ctx)
    expect([...t.sheets.keys()].sort()).toContain('members')
    expect(t.sheets.has('Sheet1')).toBe(false)
    expect(t.props.ADMIN_EMAIL).toBe('jeremy@example.com')
    expect(t.props.VAPID_PUBLIC_KEY).toMatch(/^[A-Za-z0-9_-]{87}$/)
  })

  it('signs in by emailed code and delivers a decryptable push', () => {
    expect(post({ action: 'requestCode', email: 'jeremy@example.com' })).toEqual({ ok: true, data: { sent: true } })
    const code = t.mail[0].subject.match(/(\d{6})/)![1]
    const { data } = post({ action: 'verifyCode', email: 'jeremy@example.com', code })
    expect(data.token).toBeTruthy()
    expect(post({ action: 'me', token: data.token }).data.role).toBe('admin')

    // A real browser-style subscription.
    const ecdh = createECDH('prime256v1')
    ecdh.generateKeys()
    const auth = randomBytes(16)
    post({ action: 'savePushSubscription', token: data.token, endpoint: 'https://web.push.apple.com/QGx', p256dh: ecdh.getPublicKey('base64url'), auth: auth.toString('base64url') })
    expect(post({ action: 'testPush', token: data.token }).data).toEqual({ sent: 1, devices: 1 })

    const req = t.fetches[0]
    expect(req.headers.Authorization).toMatch(/^vapid t=.+, k=/)
    const plain = ece.decrypt(Buffer.from(req.body.map((b) => b & 255)), { version: 'aes128gcm', privateKey: ecdh, authSecret: auth })
    expect(JSON.parse(plain.toString())).toMatchObject({ title: 'Family Trainer', body: 'Notifications are working. 💪' })

    // Data really landed in the sheet.
    expect(t.sheets.get('members')!.rows.length).toBe(2)
  })

  it('returns a clean error for bad input', () => {
    expect(post({ action: 'me', token: 'nope' })).toMatchObject({ ok: false, code: 'auth' })
    expect(post({ action: 'whatever' })).toMatchObject({ ok: false, code: 'not_found' })
  })
})
