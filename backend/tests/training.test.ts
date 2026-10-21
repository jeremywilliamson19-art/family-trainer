import { randomBytes } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/api'
import { handle } from '../src/router'
import { MemoryStore } from '../src/store'
import { generateVapidKeys } from '../src/webpush'
import { YOUTH, UPPER_LOWER } from '../../src/lib/programs'
import type { Program, Workout } from '../../src/lib/types'

let env: Env
let mail: string[]
let clock: number
function call<T = any>(action: string, params: Record<string, unknown> = {}, token?: string): T {
  const r = handle(env, { action, token, ...params })
  if (!r.ok) throw new Error(`${r.code}: ${r.error}`)
  return r.data as T
}
function signIn(email: string) {
  call('requestCode', { email })
  clock += 31_000
  return call<{ token: string }>('verifyCode', { email, code: mail.at(-1)!.match(/(\d{6})/)![1] }).token
}

let dad: string, mom: string, kid: string, kidId: string, dadId: string
const program = (pid: string, member_id: string, t = UPPER_LOWER) => ({ id: pid, member_id, template: t.id, name: t.name, location: t.location, days: t.days })
const workout = (wid: string, member_id: string, extra: Partial<Workout> = {}) => ({
  id: wid,
  member_id,
  date: '2026-10-21',
  name: 'Day 1',
  location: 'home',
  program_id: null,
  day_index: null,
  started_at: '2026-10-21T16:00:00Z',
  finished_at: '2026-10-21T17:00:00Z',
  exercises: [{ exercise_id: 'goblet_squat', rep_min: 8, rep_max: 12, sets: [{ weight: 20, reps: 12, rpe: 7, done: true }] }],
  ...extra,
})

beforeEach(() => {
  mail = []
  clock = Date.UTC(2026, 9, 21, 12)
  env = {
    store: new MemoryStore(),
    now: () => clock,
    random: (n) => new Uint8Array(randomBytes(n)),
    sendMail: (_t, s) => mail.push(s),
    sendPush: () => 201,
    adminEmail: 'dad@example.com',
    vapid: generateVapidKeys(),
  }
  dad = signIn('dad@example.com')
  dadId = call('me', {}, dad).id
  call('invite', { email: 'mom@example.com' }, dad)
  mom = signIn('mom@example.com')
  kidId = call('addChild', { display_name: 'Son', age_years: 12, height_in: 60, weight_lb: 105, in_season: true }, dad).id
  kid = call('redeemPairing', { code: call('createPairingCode', { child_id: kidId }, dad).code }).token
})

describe('programs', () => {
  it('members manage their own; the son’s is parent-only', () => {
    call('saveProgram', { program: program('p1', dadId) }, dad)
    expect(call('trainingSync', {}, dad).programs).toHaveLength(1)
    expect(() => call('saveProgram', { program: program('p1', dadId) }, mom)).toThrow(/forbidden/)
    expect(() => call('saveProgram', { program: program('k1', kidId, YOUTH) }, kid)).toThrow(/parent/)
    call('saveProgram', { program: program('k1', kidId, YOUTH) }, dad)
    expect(call('trainingSync', {}, kid).programs[0].youth).toBe(true)
    expect(() => call('deleteProgram', { id: 'k1' }, kid)).toThrow(/parent/)
  })

  it('the son’s prescribed effort is capped at RPE 8 even if a parent enters more', () => {
    const p = program('k1', kidId, YOUTH)
    p.days = [{ name: 'x', exercises: [{ exercise_id: 'goblet_squat', sets: 3, rep_min: 8, rep_max: 12, rest_s: 60, rpe: 10 }] }]
    call('saveProgram', { program: p }, dad)
    const saved = call<{ programs: Program[] }>('trainingSync', {}, kid).programs[0]
    expect(saved.days[0].exercises[0].rpe).toBe(8)
  })

  it('the son sees his limits; adults have none', () => {
    expect(call('trainingSync', {}, kid).limits).toEqual({ in_season: true, foot_contact_cap: 80 })
    call('saveGuardian', { child_id: kidId, patch: { foot_contact_cap: 60 } }, dad)
    expect(call('trainingSync', {}, kid).limits.foot_contact_cap).toBe(60)
    expect(call('trainingSync', {}, dad).limits).toBeNull()
  })
})

describe('workouts', () => {
  it('private to the member and the guardian', () => {
    call('saveWorkout', { workout: workout('w1', dadId) }, dad)
    call('saveWorkout', { workout: workout('k1', kidId) }, kid)
    expect(call<Workout[]>('listWorkouts', {}, mom)).toHaveLength(0)
    expect(() => call('listWorkouts', { member_id: dadId }, mom)).toThrow(/forbidden/)
    expect(() => call('listWorkouts', { member_id: dadId }, kid)).toThrow(/forbidden/)
    expect(call<Workout[]>('listWorkouts', { member_id: kidId }, dad)).toHaveLength(1)
    expect(() => call('deleteWorkout', { id: 'w1' }, mom)).toThrow(/forbidden/)
  })

  it('only a parent can mark the son’s form good; his own saves can’t change it', () => {
    call('saveWorkout', { workout: workout('k1', kidId) }, kid)
    expect(() => call('setFormGood', { workout_id: 'k1', exercise_index: 0, good: true }, kid)).toThrow(/parent/)
    expect(() => call('setFormGood', { workout_id: 'k1', exercise_index: 0, good: true }, mom)).toThrow(/forbidden/)
    call('setFormGood', { workout_id: 'k1', exercise_index: 0, good: true }, dad)
    // The son re-saves (e.g. edits a rep) and tries to clear or set the flag himself.
    const w = workout('k1', kidId)
    w.exercises[0] = { ...w.exercises[0], form_good: false }
    call('saveWorkout', { workout: w }, kid)
    expect(call<Workout[]>('listWorkouts', {}, kid)[0].exercises[0].form_good).toBe(true)
    // A brand-new session can't arrive pre-approved either.
    const w2 = workout('k2', kidId)
    w2.exercises[0] = { ...w2.exercises[0], form_good: true }
    call('saveWorkout', { workout: w2 }, kid)
    expect(call<Workout[]>('listWorkouts', {}, kid).find((x) => x.id === 'k2')!.exercises[0].form_good).toBeUndefined()
  })

  it('rejects junk', () => {
    expect(() => call('saveWorkout', { workout: workout('x', dadId, { date: 'today' }) }, dad)).toThrow(/date/)
    expect(() => call('saveWorkout', { workout: workout('x', dadId, { location: 'moon' as never }) }, dad)).toThrow(/gym or home/)
  })
})
