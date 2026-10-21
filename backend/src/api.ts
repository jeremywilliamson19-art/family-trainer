// All server logic. Google services are injected through Env so the rules
// can be tested in Node (backend/tests). Permission rules that used to be
// database RLS live here: every handler checks who is calling.
import { sha256 } from '@noble/hashes/sha2.js'
import type {
  ChildGuardianSettings,
  Day,
  DayType,
  Member,
  MemberPrivate,
  MemberSettings,
  Role,
} from '../../src/lib/types'
import { hex, toB64url, utf8 } from './b64'
import type { Store } from './store'
import { buildPushRequest, type VapidKeys } from './webpush'

export interface Env {
  store: Store
  now(): number
  random(n: number): Uint8Array
  sendMail(to: string, subject: string, html: string): void
  /** POSTs to a push service; returns the HTTP status. */
  sendPush(req: ReturnType<typeof buildPushRequest>): number
  adminEmail: string
  vapid: VapidKeys
}

export class ApiError extends Error {
  constructor(public code: 'auth' | 'forbidden' | 'invalid' | 'not_found' | 'rate_limited', message: string) {
    super(message)
  }
}

interface Session {
  member_id: string
  created_at: string
  last_seen: string
}
interface LoginCode {
  hash: string
  expires: number
  attempts: number
  sent_at: number
}
interface PairingCode {
  id: string
  child_id: string
  expires: number
}
interface Invite {
  email: string
  display_name: string | null
  invited_by: string
  created_at: string
}
interface PushSub {
  member_id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
  last_success_at: string | null
  last_error: string | null
}

type MemberRow = Member & { email: string | null }

const CODE_TTL = 15 * 60 * 1000
const MAX_CODE_ATTEMPTS = 5
const RESEND_GAP = 30 * 1000
const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_TYPES: DayType[] = ['gym', 'home', 'rest']
const SPORTS = ['football', 'basketball', 'rugby', 'soccer', 'baseball', 'track', 'wrestling', 'other']
const PAIRING_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const ADMIN_DEFAULT_DISLIKES = ['beans', 'legumes', 'edamame', 'lentils', 'chickpeas', 'hummus']

const hash = (s: string) => hex(sha256(utf8(s)))
/** Lowercased; for Gmail, dots and +tags are dropped since Gmail ignores them. */
function normEmail(e: unknown): string {
  const email = String(e ?? '').trim().toLowerCase()
  const [local, domain] = email.split('@')
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return `${local.split('+')[0].replace(/\./g, '')}@gmail.com`
  }
  return email
}
const iso = (env: Env) => new Date(env.now()).toISOString()

function publicMember(m: MemberRow): Member {
  // Email stays server-side; nobody's UI needs another member's address.
  const { email: _email, ...rest } = m
  return rest
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function num(v: unknown, lo: number, hi: number, label: string): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < lo || n > hi) throw new ApiError('invalid', `Check the ${label}`)
  return n
}
function optNum(v: unknown, lo: number, hi: number, label: string): number | null {
  return v === null || v === '' || v === undefined ? null : num(v, lo, hi, label)
}
function bool(v: unknown): boolean {
  return v === true
}
function text(v: unknown, max: number, label: string): string {
  const s = String(v ?? '').trim()
  if (!s || s.length > max) throw new ApiError('invalid', `Enter a ${label}`)
  return s
}
function strList(v: unknown, max = 50, allowed?: string[]): string[] {
  if (!Array.isArray(v)) return []
  const out = v.map((x) => String(x).trim().toLowerCase().slice(0, 60)).filter(Boolean)
  return [...new Set(allowed ? out.filter((x) => allowed.includes(x)) : out)].slice(0, max)
}
function schedule(v: unknown): Partial<Record<Day, DayType>> {
  const out: Partial<Record<Day, DayType>> = {}
  if (v && typeof v === 'object') {
    for (const [d, t] of Object.entries(v)) {
      if (DAYS.includes(d as Day) && DAY_TYPES.includes(t as DayType)) out[d as Day] = t as DayType
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Defaults for new members
// ---------------------------------------------------------------------------

function defaultSettings(memberId: string, role: Role): MemberSettings {
  return {
    member_id: memberId,
    track_food: true,
    track_workouts: true,
    feed_workouts: true,
    feed_prs: true,
    feed_test_bests: true,
    feed_streaks: true,
    feed_body: false,
    dislikes: role === 'admin' ? [...ADMIN_DEFAULT_DISLIKES] : [],
    weekly_schedule: {},
    home_equipment: [],
  }
}

function emptyPrivate(memberId: string): MemberPrivate {
  return { member_id: memberId, sex: null, age_years: null, height_in: null, weight_lb: null, goal_weight_lb: null, activity_level: null }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function memberByEmail(env: Env, email: string): MemberRow | null {
  return env.store.all<MemberRow>('members').find((m) => m.email === email) ?? null
}

function householdId(env: Env): string {
  return env.store.all<MemberRow>('members').find((m) => m.role === 'admin')?.household_id ?? toB64url(env.random(12))
}

function createMember(env: Env, email: string, role: 'admin' | 'adult', displayName: string): MemberRow {
  const m: MemberRow = {
    id: toB64url(env.random(12)),
    household_id: householdId(env),
    role,
    display_name: displayName,
    guardian_id: null,
    sports: [],
    in_season: false,
    timezone: 'America/Denver',
    onboarded_at: null,
    email,
  }
  env.store.put('members', m.id, m)
  env.store.put('member_settings', m.id, defaultSettings(m.id, role))
  env.store.put('member_private', m.id, emptyPrivate(m.id))
  return m
}

function startSession(env: Env, memberId: string): { token: string } {
  const token = toB64url(env.random(32))
  env.store.put<Session>('sessions', hash(token), { member_id: memberId, created_at: iso(env), last_seen: iso(env) })
  return { token }
}

function caller(env: Env, token: unknown): MemberRow {
  if (typeof token !== 'string' || !token) throw new ApiError('auth', 'Not signed in')
  const s = env.store.get<Session>('sessions', hash(token))
  const m = s && env.store.get<MemberRow>('members', s.member_id)
  if (!s || !m) throw new ApiError('auth', 'Not signed in')
  // Touch at most once a day to keep writes down.
  if (env.now() - Date.parse(s.last_seen) > 24 * 3600 * 1000) {
    env.store.put<Session>('sessions', hash(token), { ...s, last_seen: iso(env) })
  }
  return m
}

/** The member themself, or the guardian of that child. */
function canManage(env: Env, me: MemberRow, targetId: string): MemberRow {
  const target = env.store.get<MemberRow>('members', targetId)
  if (!target) throw new ApiError('not_found', 'Member not found')
  if (target.id === me.id) return target
  if (target.role === 'child' && target.guardian_id === me.id) return target
  throw new ApiError('forbidden', 'Not allowed')
}

function requireAdmin(me: MemberRow) {
  if (me.role !== 'admin') throw new ApiError('forbidden', 'Only the household admin can do that')
}

function requestCode(env: Env, p: { email?: unknown }) {
  const email = normEmail(p.email)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError('invalid', 'Enter a valid email')
  const allowed = email === normEmail(env.adminEmail) || !!memberByEmail(env, email) || !!env.store.get('invites', email)
  if (!allowed) {
    throw new ApiError('forbidden', `${email} isn’t on the family list. Check for a typo, or ask Jeremy to add it.`)
  }
  const prev = env.store.get<LoginCode>('login_codes', email)
  if (prev && env.now() - prev.sent_at < RESEND_GAP) {
    throw new ApiError('rate_limited', 'A code was just sent. Wait 30 seconds before asking for another.')
  }
  const r = env.random(4)
  const code = String((((r[0] << 24) | (r[1] << 16) | (r[2] << 8) | r[3]) >>> 0) % 1_000_000).padStart(6, '0')
  env.store.put<LoginCode>('login_codes', email, { hash: hash(`${email}:${code}`), expires: env.now() + CODE_TTL, attempts: 0, sent_at: env.now() })
  env.sendMail(
    email,
    `Your Family Trainer code: ${code}`,
    `<h2>Your Family Trainer sign-in code</h2>
     <p style="font-size:32px;font-weight:700;letter-spacing:6px;font-family:monospace">${code}</p>
     <p>Type this code into the app. It expires in 15 minutes.</p>
     <p>If you didn't try to sign in, ignore this email.</p>`,
  )
  return { sent: true }
}

function verifyCode(env: Env, p: { email?: unknown; code?: unknown; display_name?: unknown }) {
  const email = normEmail(p.email)
  const code = String(p.code ?? '').replace(/\D/g, '')
  const row = env.store.get<LoginCode>('login_codes', email)
  const bad = () => new ApiError('invalid', 'That code didn’t work. Check the newest email, or send a new code.')
  if (!row || row.expires < env.now() || row.attempts >= MAX_CODE_ATTEMPTS) throw bad()
  if (row.hash !== hash(`${email}:${code}`)) {
    env.store.put<LoginCode>('login_codes', email, { ...row, attempts: row.attempts + 1 })
    throw bad()
  }
  env.store.del('login_codes', email)

  let member = memberByEmail(env, email)
  if (!member) {
    const invite = env.store.get<Invite>('invites', email)
    if (email === normEmail(env.adminEmail) && !env.store.all<MemberRow>('members').some((m) => m.role === 'admin')) {
      member = createMember(env, email, 'admin', 'Jeremy')
    } else if (invite) {
      member = createMember(env, email, 'adult', invite.display_name ?? email.split('@')[0])
      env.store.del('invites', email)
    } else {
      throw new ApiError('forbidden', 'This email isn’t on the family list.')
    }
  }
  return startSession(env, member.id)
}

function redeemPairing(env: Env, p: { code?: unknown }) {
  const code = String(p.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (code.length !== 8) throw new ApiError('invalid', 'Pairing codes are 8 characters')
  const id = hash(`pair:${code}`)
  const row = env.store.get<PairingCode>('pairing_codes', id)
  if (!row || row.expires < env.now()) {
    throw new ApiError('invalid', "That code didn't work. It may have expired. Ask for a new one.")
  }
  env.store.del('pairing_codes', id)
  return startSession(env, row.child_id)
}

// ---------------------------------------------------------------------------
// Household
// ---------------------------------------------------------------------------

function createPairingCode(env: Env, me: MemberRow, p: { child_id?: unknown }) {
  const child = env.store.get<MemberRow>('members', String(p.child_id))
  if (!child || child.role !== 'child' || child.guardian_id !== me.id) throw new ApiError('forbidden', 'Not your child account')
  // A new code revokes any older unused ones for this child.
  for (const row of env.store.all<PairingCode>('pairing_codes')) {
    if (row.child_id === child.id) env.store.del('pairing_codes', row.id)
  }
  const bytes = env.random(8)
  const code = Array.from(bytes, (b) => PAIRING_ALPHABET[b % PAIRING_ALPHABET.length]).join('')
  const expires = env.now() + CODE_TTL
  const id = hash(`pair:${code}`)
  env.store.put<PairingCode>('pairing_codes', id, { id, child_id: child.id, expires })
  return { code, expires_at: new Date(expires).toISOString() }
}

function addChild(env: Env, me: MemberRow, p: Record<string, unknown>) {
  requireAdmin(me)
  const child: MemberRow = {
    id: toB64url(env.random(12)),
    household_id: me.household_id,
    role: 'child',
    display_name: text(p.display_name, 40, 'name'),
    guardian_id: me.id,
    sports: strList(p.sports, 10, SPORTS),
    in_season: bool(p.in_season),
    timezone: me.timezone,
    onboarded_at: iso(env),
    email: null,
  }
  const priv: MemberPrivate = {
    ...emptyPrivate(child.id),
    age_years: num(p.age_years, 5, 17, 'age'),
    height_in: num(p.height_in, 36, 84, 'height'),
    weight_lb: num(p.weight_lb, 30, 350, 'weight'),
  }
  env.store.put('members', child.id, child)
  env.store.put('member_private', child.id, priv)
  env.store.put('member_settings', child.id, { ...defaultSettings(child.id, 'child'), weekly_schedule: schedule(p.weekly_schedule) })
  env.store.put<ChildGuardianSettings>('child_guardian_settings', child.id, {
    child_id: child.id,
    protein_g_per_lb: 0.7,
    foot_contact_cap: 80,
    test_reminder_weeks: 4,
  })
  return { id: child.id }
}

function invite(env: Env, me: MemberRow, p: { email?: unknown; display_name?: unknown }) {
  requireAdmin(me)
  const email = normEmail(p.email)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError('invalid', 'Enter a valid email')
  if (memberByEmail(env, email)) throw new ApiError('invalid', 'That person is already in the family.')
  if (env.store.get('invites', email)) throw new ApiError('invalid', 'That email already has an invite.')
  const name = String(p.display_name ?? '').trim().slice(0, 40) || null
  env.store.put<Invite>('invites', email, { email, display_name: name, invited_by: me.id, created_at: iso(env) })
  return { ok: true }
}

function updateMember(env: Env, me: MemberRow, p: { member_id?: unknown; patch?: Record<string, unknown> }) {
  const target = canManage(env, me, String(p.member_id ?? me.id))
  const patch = p.patch ?? {}
  const next = { ...target }
  if ('display_name' in patch) next.display_name = text(patch.display_name, 40, 'name')
  // Sports and season belong to the guardian for a child.
  if (target.role === 'child' && me.id !== target.id) {
    if ('sports' in patch) next.sports = strList(patch.sports, 10, SPORTS)
    if ('in_season' in patch) next.in_season = bool(patch.in_season)
  }
  env.store.put('members', target.id, next)
  return publicMember(next)
}

// ---------------------------------------------------------------------------
// Per-member rows
// ---------------------------------------------------------------------------

function sanitizeSettings(target: MemberRow, cur: MemberSettings, patch: Record<string, unknown>): MemberSettings {
  const next = { ...cur }
  for (const k of ['track_food', 'track_workouts', 'feed_workouts', 'feed_prs', 'feed_test_bests', 'feed_streaks', 'feed_body'] as const) {
    if (k in patch) next[k] = bool(patch[k])
  }
  if ('dislikes' in patch) next.dislikes = strList(patch.dislikes)
  if ('home_equipment' in patch) next.home_equipment = strList(patch.home_equipment, 20)
  if ('weekly_schedule' in patch) next.weekly_schedule = schedule(patch.weekly_schedule)
  // A child's body measurements never post to the feed.
  if (target.role === 'child') next.feed_body = false
  return next
}

function getSettings(env: Env, me: MemberRow, p: { member_id?: unknown }) {
  const target = canManage(env, me, String(p.member_id ?? me.id))
  return env.store.get<MemberSettings>('member_settings', target.id) ?? defaultSettings(target.id, target.role)
}

function saveSettings(env: Env, me: MemberRow, p: { member_id?: unknown; patch?: Record<string, unknown> }) {
  const target = canManage(env, me, String(p.member_id ?? me.id))
  // Children can change feed toggles; their schedule is the parent's job.
  const patch = { ...(p.patch ?? {}) }
  if (me.role === 'child') {
    for (const k of Object.keys(patch)) if (!k.startsWith('feed_')) delete patch[k]
  }
  const next = sanitizeSettings(target, getSettings(env, me, { member_id: target.id }), patch)
  env.store.put('member_settings', target.id, next)
  return next
}

/** Body data: adults see their own, guardians see their child's. A child sees nothing, ever. */
function privateTarget(env: Env, me: MemberRow, memberId: unknown) {
  if (me.role === 'child') throw new ApiError('forbidden', 'Not allowed')
  return canManage(env, me, String(memberId ?? me.id))
}

function getPrivate(env: Env, me: MemberRow, p: { member_id?: unknown }) {
  const target = privateTarget(env, me, p.member_id)
  return env.store.get<MemberPrivate>('member_private', target.id) ?? emptyPrivate(target.id)
}

function savePrivate(env: Env, me: MemberRow, p: { member_id?: unknown; patch?: Record<string, unknown> }) {
  const target = privateTarget(env, me, p.member_id)
  const cur = getPrivate(env, me, { member_id: target.id })
  const patch = p.patch ?? {}
  const next = { ...cur }
  if ('sex' in patch) next.sex = patch.sex === 'male' || patch.sex === 'female' ? patch.sex : null
  if ('age_years' in patch) next.age_years = optNum(patch.age_years, 5, 110, 'age')
  if ('height_in' in patch) next.height_in = optNum(patch.height_in, 30, 96, 'height')
  if ('weight_lb' in patch) next.weight_lb = optNum(patch.weight_lb, 30, 700, 'weight')
  if ('goal_weight_lb' in patch) next.goal_weight_lb = optNum(patch.goal_weight_lb, 30, 700, 'goal weight')
  if ('activity_level' in patch) {
    const a = String(patch.activity_level)
    next.activity_level = ['sedentary', 'light', 'moderate', 'very_active'].includes(a) ? a : null
  }
  env.store.put('member_private', target.id, next)
  return next
}

function guardianTarget(env: Env, me: MemberRow, childId: unknown) {
  const target = env.store.get<MemberRow>('members', String(childId))
  if (!target || target.role !== 'child' || target.guardian_id !== me.id) throw new ApiError('forbidden', 'Not allowed')
  return target
}

function getGuardian(env: Env, me: MemberRow, p: { child_id?: unknown }) {
  const t = guardianTarget(env, me, p.child_id)
  return env.store.get<ChildGuardianSettings>('child_guardian_settings', t.id)
}

function saveGuardian(env: Env, me: MemberRow, p: { child_id?: unknown; patch?: Record<string, unknown> }) {
  const t = guardianTarget(env, me, p.child_id)
  const cur = env.store.get<ChildGuardianSettings>('child_guardian_settings', t.id)!
  const patch = p.patch ?? {}
  const next = { ...cur }
  if ('protein_g_per_lb' in patch) next.protein_g_per_lb = num(patch.protein_g_per_lb, 0.3, 1.2, 'protein target')
  if ('foot_contact_cap' in patch) next.foot_contact_cap = num(patch.foot_contact_cap, 10, 200, 'foot-contact cap')
  if ('test_reminder_weeks' in patch) next.test_reminder_weeks = num(patch.test_reminder_weeks, 1, 26, 'reminder weeks')
  env.store.put('child_guardian_settings', t.id, next)
  return next
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

function savePushSubscription(env: Env, me: MemberRow, p: Record<string, unknown>) {
  const endpoint = String(p.endpoint ?? '')
  if (!/^https:\/\//.test(endpoint)) throw new ApiError('invalid', 'Bad subscription')
  const sub: PushSub = {
    member_id: me.id,
    endpoint,
    p256dh: String(p.p256dh ?? ''),
    auth: String(p.auth ?? ''),
    user_agent: String(p.user_agent ?? '').slice(0, 300) || null,
    last_success_at: null,
    last_error: null,
  }
  env.store.put('push_subscriptions', hash(endpoint), sub)
  return { ok: true }
}

function deletePushSubscription(env: Env, me: MemberRow, p: { endpoint?: unknown }) {
  const id = hash(String(p.endpoint ?? ''))
  const sub = env.store.get<PushSub>('push_subscriptions', id)
  if (sub && sub.member_id === me.id) env.store.del('push_subscriptions', id)
  return { ok: true }
}

export interface PushMessage {
  title: string
  body: string
  url?: string
  tag?: string
}

/** Sends to every device the member has. Dead subscriptions are removed. */
export function sendToMember(env: Env, memberId: string, msg: PushMessage) {
  const subs = env.store.all<PushSub>('push_subscriptions').filter((s) => s.member_id === memberId)
  let sent = 0
  for (const s of subs) {
    const id = hash(s.endpoint)
    let status = 0
    let error: string | null = null
    try {
      status = env.sendPush(buildPushRequest(s, msg, env.vapid, `mailto:${env.adminEmail}`))
    } catch (e) {
      error = String((e as Error).message ?? e).slice(0, 300)
    }
    if (status === 404 || status === 410) {
      env.store.del('push_subscriptions', id)
    } else if (status >= 200 && status < 300) {
      sent++
      env.store.put<PushSub>('push_subscriptions', id, { ...s, last_success_at: iso(env), last_error: null })
    } else {
      env.store.put<PushSub>('push_subscriptions', id, { ...s, last_error: error ?? `HTTP ${status}` })
    }
  }
  return { sent, devices: subs.length }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

type Params = Record<string, unknown>
const PUBLIC: Record<string, (env: Env, p: Params) => unknown> = {
  requestCode,
  verifyCode,
  redeemPairing,
  vapidPublicKey: (env) => ({ key: env.vapid.publicKey }),
}

const AUTHED: Record<string, (env: Env, me: MemberRow, p: Params) => unknown> = {
  me: (_env, me) => publicMember(me),
  signOut: (env, _me, p) => {
    env.store.del('sessions', hash(String(p.token)))
    return { ok: true }
  },
  listMembers: (env, me) =>
    env.store
      .all<MemberRow>('members')
      .filter((m) => m.household_id === me.household_id)
      .map(publicMember),
  updateMember,
  getSettings,
  saveSettings,
  getPrivate,
  savePrivate,
  getGuardian,
  saveGuardian,
  invite,
  listInvites: (env, me) => {
    requireAdmin(me)
    return env.store.all<Invite>('invites')
  },
  revokeInvite: (env, me, p) => {
    requireAdmin(me)
    env.store.del('invites', normEmail(p.email))
    return { ok: true }
  },
  addChild,
  createPairingCode,
  savePushSubscription,
  deletePushSubscription,
  testPush: (env, me) => sendToMember(env, me.id, { title: 'Family Trainer', body: 'Notifications are working. 💪', url: '/settings', tag: 'test' }),
}

export function handle(env: Env, body: Params): { ok: true; data: unknown } | { ok: false; error: string; code: string } {
  try {
    const action = String(body.action ?? '')
    if (PUBLIC[action]) return { ok: true, data: PUBLIC[action](env, body) }
    if (AUTHED[action]) return { ok: true, data: AUTHED[action](env, caller(env, body.token), body) }
    throw new ApiError('not_found', `Unknown action "${action}"`)
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: e.message, code: e.code }
    console.error(e)
    return { ok: false, error: 'Something went wrong. Try again.', code: 'server' }
  }
}
