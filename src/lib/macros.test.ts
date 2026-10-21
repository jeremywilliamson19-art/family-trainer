import { describe, expect, it } from 'vitest'
import { bmr, childProteinTarget, computeTargets, type Profile } from './macros'

// Worked by hand:
//   210 lb = 95.254 kg, 70 in = 177.8 cm, age 40, male
//   BMR  = 10(95.254) + 6.25(177.8) − 5(40) + 5 = 952.54 + 1111.25 − 200 + 5 = 1868.79
//   TDEE = 1868.79 × 1.55 = 2896.62;  target = × 0.8 = 2317.30
//   Protein = 185 g (goal weight) = 740 kcal
//   Fat     = 0.35 × 210 = 73.5 g = 661.5 kcal
//   Carbs   = (2317.30 − 740 − 661.5) / 4 = 228.95 g
//   Loss    = 2896.62 × 0.2 × 7 / 3500 = 1.16 lb/week (< 2.1 lb = 1%)
const jeremy: Profile = { sex: 'male', age_years: 40, height_in: 70, weight_lb: 210, goal_weight_lb: 185, activity_level: 'moderate' }

describe('macro targets', () => {
  it('matches the hand calculation', () => {
    expect(bmr(jeremy)).toBeCloseTo(1868.79, 1)
    const t = computeTargets(jeremy, {}, false)
    expect(t).toMatchObject({ bmr: 1869, tdee: 2897, calories: 2317, protein_g: 185, fat_g: 74, carbs_g: 229, loss_lb_per_week: 1.2, too_fast: false })
  })

  it('women use −161', () => {
    expect(bmr({ ...jeremy, sex: 'female' }) - bmr(jeremy)).toBeCloseTo(-166, 5)
  })

  it('without a goal weight, protein is 0.8 g per lb of current weight', () => {
    expect(computeTargets({ ...jeremy, goal_weight_lb: null }, {}, false).protein_g).toBe(168)
  })

  it('warns when the deficit would lose more than 1% a week', () => {
    // 100 lb, 76 in, 20 y, very active: TDEE ≈ 2700 → 1.08 lb/week > 1.0 lb (1%).
    const t = computeTargets({ ...jeremy, weight_lb: 100, goal_weight_lb: null, height_in: 76, age_years: 20, activity_level: 'very_active' }, {}, false)
    expect(t.too_fast).toBe(true)
  })

  it('training-day carb shift keeps weekly calories the same', () => {
    const sched = { mon: 'gym', tue: 'home', thu: 'gym', fri: 'home', sat: 'gym' } as const // 5 training, 2 rest
    const flat = computeTargets(jeremy, sched, false)
    const shifted = computeTargets(jeremy, sched, true)
    const week = (t: typeof flat) => Object.values(t.by_day).reduce((n, d) => n + d.calories, 0)
    expect(Math.abs(week(shifted) - week(flat))).toBeLessThanOrEqual(4) // rounding only
    expect(shifted.by_day.sun.carbs_g).toBe(Math.round(228.95 * 0.9)) // rest −10%
    expect(shifted.by_day.mon.carbs_g).toBe(Math.round(228.95 * (1 + (0.1 * 2) / 5))) // smaller bump
    expect(shifted.by_day.mon.training).toBe(true)
  })

  it('equal split is exactly ±10%', () => {
    const t = computeTargets(jeremy, { mon: 'gym', wed: 'gym', fri: 'home' }, true) // 3 vs 4: rest moves less
    expect(t.by_day.mon.carbs_g).toBe(Math.round(228.95 * 1.1))
    expect(t.by_day.tue.carbs_g).toBe(Math.round(228.95 * (1 - 0.3 / 4)))
  })

  it('son: 0.7 g per lb', () => {
    expect(childProteinTarget(105, 0.7)).toBe(74)
  })
})
