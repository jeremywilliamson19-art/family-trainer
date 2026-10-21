import { randomBytes } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/api'
import { handle } from '../src/router'
import { MemoryStore } from '../src/store'
import { generateVapidKeys } from '../src/webpush'
import type { Food, Meal } from '../../src/lib/types'

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

const chicken: Food = { id: 'usda:171477', source: 'usda', name: 'Chicken breast, roasted', serving_label: '100 g', serving_g: 100, kcal: 165, protein: 31, carbs: 0, fat: 3.6, category: 5 }
const meal = (id: string, extra: Partial<Meal> = {}) => ({ id, date: '2026-10-21', meal_type: 'dinner', items: [{ food: chicken, servings: 2 }], ...extra })

let dad: string, mom: string, kid: string, kidId: string, dadId: string

beforeEach(() => {
  mail = []
  clock = Date.UTC(2026, 9, 21, 12)
  env = {
    store: new MemoryStore(),
    now: () => clock,
    random: (n) => new Uint8Array(randomBytes(n)),
    sendMail: (_to, subject) => mail.push(subject),
    sendPush: () => 201,
    adminEmail: 'dad@example.com',
    vapid: generateVapidKeys(),
  }
  dad = signIn('dad@example.com')
  dadId = call('me', {}, dad).id
  call('invite', { email: 'mom@example.com' }, dad)
  mom = signIn('mom@example.com')
  kidId = call('addChild', { display_name: 'Son', age_years: 12, height_in: 60, weight_lb: 105 }, dad).id
  kid = call('redeemPairing', { code: call('createPairingCode', { child_id: kidId }, dad).code }).token
})

describe('targets', () => {
  it('appear once the profile is complete, and follow schedule changes', () => {
    expect(call('getTargets', {}, dad)).toBeNull()
    call('savePrivate', { patch: { sex: 'male', age_years: 40, height_in: 70, weight_lb: 210, goal_weight_lb: 185, activity_level: 'moderate' } }, dad)
    const t = call('getTargets', {}, dad)
    expect(t).toMatchObject({ kind: 'adult', calories: 2317, protein_g: 185, fat_g: 74, carbs_g: 229 })
    expect(t.by_day.mon.carbs_g).toBe(229)
    call('saveSettings', { patch: { weekly_schedule: { mon: 'gym', wed: 'gym', fri: 'home' } } }, dad)
    expect(call('getTargets', {}, dad).by_day.mon.carbs_g).toBe(252)
  })

  it('the child gets protein only, from the guardian’s g/lb setting', () => {
    const t = call('getTargets', {}, kid)
    expect(t).toEqual({ kind: 'child', protein_g: 74 })
    call('saveGuardian', { child_id: kidId, patch: { protein_g_per_lb: 0.8 } }, dad)
    expect(call('getTargets', {}, kid)).toEqual({ kind: 'child', protein_g: 84 })
    call('savePrivate', { member_id: kidId, patch: { weight_lb: 110 } }, dad)
    expect(call('getTargets', { member_id: kidId }, dad)).toEqual({ kind: 'child', protein_g: 88 })
  })

  it('mom can’t read dad’s targets', () => {
    expect(() => call('getTargets', { member_id: dadId }, mom)).toThrow(/forbidden/)
  })
})

describe('meals', () => {
  it('save is idempotent and edits keep the original log time', () => {
    call('saveMeal', { meal: meal('m1') }, dad)
    const first = call<Meal[]>('listMeals', {}, dad)[0].logged_at
    clock += 60_000
    call('saveMeal', { meal: meal('m1', { meal_type: 'lunch' }) }, dad)
    const meals = call<Meal[]>('listMeals', {}, dad)
    expect(meals).toHaveLength(1)
    expect(meals[0]).toMatchObject({ meal_type: 'lunch', logged_at: first })
  })

  it('members only see their own; the guardian sees the child’s', () => {
    call('saveMeal', { meal: meal('d1') }, dad)
    call('saveMeal', { meal: meal('k1') }, kid)
    expect(call<Meal[]>('listMeals', {}, mom)).toHaveLength(0)
    expect(() => call('listMeals', { member_id: dadId }, mom)).toThrow(/forbidden/)
    expect(() => call('listMeals', { member_id: dadId }, kid)).toThrow(/forbidden/)
    expect(call<Meal[]>('listMeals', { member_id: kidId }, dad)).toHaveLength(1)
    // Mom can't overwrite or delete Dad's meal by id.
    expect(() => call('saveMeal', { meal: meal('d1') }, mom)).toThrow(/forbidden/)
    expect(() => call('deleteMeal', { id: 'd1' }, mom)).toThrow(/forbidden/)
    expect(call<Meal[]>('listMeals', {}, dad)).toHaveLength(1)
  })

  it('a child account never receives calories, carbs or fat', () => {
    call('saveMeal', { meal: meal('k1') }, kid)
    call('saveFood', { food: { ...chicken, id: 'c:bar', source: 'custom', name: 'Protein bar', kcal: 210, carbs: 22, fat: 7, protein: 20 } }, dad)
    call('saveFavorite', { favorite: { id: 'f1', name: 'Chicken', meal_type: 'dinner', items: [{ food: chicken, servings: 1 }] } }, kid)
    const sync = call('nutritionSync', {}, kid)
    const json = JSON.stringify(sync)
    expect(json).not.toMatch(/"kcal":\d|"carbs":\d|"fat":\d|calories|carbs_g|fat_g/)
    expect(json).toMatch(/"protein":31/)
    // Dad still sees the full numbers for the child's meal.
    expect(JSON.stringify(call('listMeals', { member_id: kidId }, dad))).toMatch(/"kcal":165/)
  })

  it('rejects junk', () => {
    expect(() => call('saveMeal', { meal: meal('x', { items: [] }) }, dad)).toThrow(/at least one/)
    expect(() => call('saveMeal', { meal: meal('x', { date: 'yesterday' }) }, dad)).toThrow(/date/)
    expect(() => call('saveMeal', { meal: meal('x', { items: [{ food: { ...chicken, kcal: -5 }, servings: 1 }] }) }, dad)).toThrow(/nutrition/)
  })
})

describe('household foods', () => {
  it('are shared, and a child can’t overwrite label data', () => {
    const bar = { ...chicken, id: 'c:bar', source: 'custom', name: 'Protein bar', kcal: 210, carbs: 22, fat: 7, protein: 20 }
    call('saveFood', { food: bar }, mom)
    expect(call<Food[]>('listFoods', {}, dad).map((f) => f.name)).toEqual(['Protein bar'])
    call('saveFood', { food: { ...bar, kcal: null, protein: 99 } }, kid)
    expect(call<Food[]>('listFoods', {}, dad)[0]).toMatchObject({ kcal: 210, protein: 20 })
  })
})
