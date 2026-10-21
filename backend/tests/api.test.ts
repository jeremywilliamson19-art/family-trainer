// The household's privacy rules, checked against the real API handlers with
// an in-memory store. These replace the old Postgres RLS tests.
import { randomBytes } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { handle, type Env } from '../src/api'
import { MemoryStore } from '../src/store'
import { generateVapidKeys } from '../src/webpush'

const DAD = 'jeremywilliamson19@gmail.com'
const MOM = 'amanda@example.com'

let env: Env
let mail: { to: string; subject: string }[]
let pushes: string[]
let clock: number

function call<T = any>(action: string, params: Record<string, unknown> = {}, token?: string): T {
  const r = handle(env, { action, token, ...params })
  if (!r.ok) throw new Error(`${r.code}: ${r.error}`)
  return r.data as T
}

function signIn(email: string): string {
  call('requestCode', { email })
  const code = mail.at(-1)!.subject.match(/(\d{6})/)![1]
  clock += 31_000 // past the resend gap for the next caller
  return call<{ token: string }>('verifyCode', { email, code }).token
}

beforeEach(() => {
  mail = []
  pushes = []
  clock = Date.UTC(2026, 9, 20, 12)
  env = {
    store: new MemoryStore(),
    now: () => clock,
    random: (n) => new Uint8Array(randomBytes(n)),
    sendMail: (to, subject) => mail.push({ to, subject }),
    sendPush: (req) => (pushes.push(req.url), 201),
    adminEmail: DAD,
    vapid: generateVapidKeys(),
  }
})

describe('sign-in', () => {
  it('the admin email bootstraps the household; dislikes are pre-filled', () => {
    const t = signIn(DAD)
    expect(call('me', {}, t)).toMatchObject({ role: 'admin', display_name: 'Jeremy' })
    expect(call('getSettings', {}, t).dislikes).toContain('beans')
  })

  it('Gmail addresses match regardless of dots, +tags and case', () => {
    call('requestCode', { email: ' Jeremy.Williamson19+trainer@GMAIL.com' })
    const code = mail[0].subject.match(/(\d{6})/)![1]
    const t = call<{ token: string }>('verifyCode', { email: 'jeremy.williamson19@gmail.com', code }).token
    expect(call('me', {}, t).role).toBe('admin')
    expect(mail[0].to).toBe('jeremywilliamson19@gmail.com')
  })

  it('strangers get no code and no email is sent', () => {
    expect(() => call('requestCode', { email: 'stranger@example.com' })).toThrow(/forbidden/)
    expect(mail).toHaveLength(0)
  })

  it('codes expire, are single-use, and lock after 5 wrong tries', () => {
    call('requestCode', { email: DAD })
    const code = mail[0].subject.match(/(\d{6})/)![1]
    const wrong = code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) expect(() => call('verifyCode', { email: DAD, code: wrong })).toThrow(/didn’t work/)
    expect(() => call('verifyCode', { email: DAD, code })).toThrow(/didn’t work/)

    clock += 31_000
    call('requestCode', { email: DAD })
    const code2 = mail[1].subject.match(/(\d{6})/)![1]
    clock += 16 * 60_000
    expect(() => call('verifyCode', { email: DAD, code: code2 })).toThrow(/didn’t work/)
  })

  it('resending is rate limited', () => {
    call('requestCode', { email: DAD })
    expect(() => call('requestCode', { email: DAD })).toThrow(/rate_limited/)
  })

  it('requests without a valid token are rejected', () => {
    expect(() => call('me', {}, 'nope')).toThrow(/auth/)
    expect(() => call('me')).toThrow(/auth/)
  })

  it('sign-out kills the token', () => {
    const t = signIn(DAD)
    call('signOut', {}, t)
    expect(() => call('me', {}, t)).toThrow(/auth/)
  })
})

describe('household', () => {
  let dad: string
  let mom: string
  let kid: string
  let kidId: string
  let dadId: string

  beforeEach(() => {
    dad = signIn(DAD)
    dadId = call('me', {}, dad).id
    call('invite', { email: 'Amanda@Example.com', display_name: 'Amanda' }, dad)
    mom = signIn(MOM)
    kidId = call('addChild', { display_name: 'Son', age_years: 12, height_in: 60, weight_lb: 105, sports: ['football', 'hacking'], in_season: false }, dad).id
    const { code } = call('createPairingCode', { child_id: kidId }, dad)
    kid = call('redeemPairing', { code: code.toLowerCase() }).token
    call('savePrivate', { patch: { weight_lb: 210 } }, dad)
  })

  it('invitees join as adults with the invited name; only the admin invites', () => {
    expect(call('me', {}, mom)).toMatchObject({ role: 'adult', display_name: 'Amanda' })
    expect(() => call('invite', { email: 'x@example.com' }, mom)).toThrow(/forbidden/)
    expect(() => call('addChild', { display_name: 'X', age_years: 9, height_in: 50, weight_lb: 60 }, mom)).toThrow(/forbidden/)
  })

  it('nobody can make themselves admin', () => {
    call('updateMember', { patch: { role: 'admin', display_name: 'Mom' } }, mom)
    expect(call('me', {}, mom)).toMatchObject({ role: 'adult', display_name: 'Mom' })
  })

  it('the child can never read body data, including his own', () => {
    expect(() => call('getPrivate', {}, kid)).toThrow(/forbidden/)
    expect(() => call('getPrivate', { member_id: kidId }, kid)).toThrow(/forbidden/)
    expect(() => call('savePrivate', { patch: { weight_lb: 90 } }, kid)).toThrow(/forbidden/)
    expect(() => call('getGuardian', { child_id: kidId }, kid)).toThrow(/forbidden/)
    expect(JSON.stringify(call('me', {}, kid))).not.toMatch(/weight|105/)
    expect(JSON.stringify(call('listMembers', {}, kid))).not.toMatch(/weight|210|105|@/)
  })

  it('the guardian sees the child; mom sees neither dad nor the child', () => {
    expect(call('getPrivate', { member_id: kidId }, dad).weight_lb).toBe(105)
    expect(() => call('getPrivate', { member_id: kidId }, mom)).toThrow(/forbidden/)
    expect(() => call('getPrivate', { member_id: dadId }, mom)).toThrow(/forbidden/)
    expect(() => call('getSettings', { member_id: dadId }, kid)).toThrow(/forbidden/)
    expect(call('getGuardian', { child_id: kidId }, dad).protein_g_per_lb).toBe(0.7)
  })

  it('child account never posts body data to the feed and can only change feed toggles', () => {
    call('saveSettings', { member_id: kidId, patch: { feed_body: true } }, dad)
    expect(call('getSettings', { member_id: kidId }, dad).feed_body).toBe(false)
    const s = call('saveSettings', { patch: { feed_prs: false, feed_body: true, weekly_schedule: { mon: 'gym' } } }, kid)
    expect(s).toMatchObject({ feed_prs: false, feed_body: false, weekly_schedule: {} })
  })

  it('unknown sports are dropped and the guardian controls season', () => {
    expect(call('me', {}, kid).sports).toEqual(['football'])
    call('updateMember', { member_id: kidId, patch: { in_season: true } }, kid)
    expect(call('me', {}, kid).in_season).toBe(false)
    call('updateMember', { member_id: kidId, patch: { in_season: true } }, dad)
    expect(call('me', {}, kid).in_season).toBe(true)
  })

  it('pairing codes: guardian only, single use, newest wins, 15 minutes', () => {
    expect(() => call('createPairingCode', { child_id: kidId }, mom)).toThrow(/forbidden/)
    expect(() => call('createPairingCode', { child_id: kidId }, kid)).toThrow(/forbidden/)
    const a = call('createPairingCode', { child_id: kidId }, dad).code
    const b = call('createPairingCode', { child_id: kidId }, dad).code
    expect(b).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
    expect(() => call('redeemPairing', { code: a })).toThrow(/expired/)
    call('redeemPairing', { code: b })
    expect(() => call('redeemPairing', { code: b })).toThrow(/expired/)
    const c = call('createPairingCode', { child_id: kidId }, dad).code
    clock += 16 * 60_000
    expect(() => call('redeemPairing', { code: c })).toThrow(/expired/)
  })

  it('push goes only to your own devices; dead ones are removed', () => {
    call('savePushSubscription', { endpoint: 'https://push.example/dad', p256dh: generateVapidKeys().publicKey, auth: 'AAAAAAAAAAAAAAAAAAAAAA' }, dad)
    call('savePushSubscription', { endpoint: 'https://push.example/mom', p256dh: generateVapidKeys().publicKey, auth: 'AAAAAAAAAAAAAAAAAAAAAA' }, mom)
    expect(call('testPush', {}, dad)).toEqual({ sent: 1, devices: 1 })
    expect(pushes).toEqual(['https://push.example/dad'])
    // Mom can't delete Dad's device.
    call('deletePushSubscription', { endpoint: 'https://push.example/dad' }, mom)
    env.sendPush = () => 410
    expect(call('testPush', {}, dad)).toEqual({ sent: 0, devices: 1 })
    expect(call('testPush', {}, dad)).toEqual({ sent: 0, devices: 0 })
  })
})
