// Calorie and macro targets (spec section 4). Shared by the app and the
// Apps Script backend so both always agree.
import type { Day, DayType } from './types'

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active'

export const ACTIVITY: Record<ActivityLevel, { multiplier: number; label: string; hint: string }> = {
  sedentary: { multiplier: 1.2, label: 'Sedentary', hint: 'Desk job, little exercise' },
  light: { multiplier: 1.375, label: 'Light', hint: 'Exercise 1–3 days a week' },
  moderate: { multiplier: 1.55, label: 'Moderate', hint: 'Exercise 3–5 days a week' },
  very_active: { multiplier: 1.725, label: 'Very active', hint: 'Hard exercise 6–7 days a week' },
}

export interface Profile {
  sex: 'male' | 'female'
  age_years: number
  height_in: number
  weight_lb: number
  goal_weight_lb: number | null
  activity_level: ActivityLevel
}

export interface DayTarget {
  calories: number
  carbs_g: number
  training: boolean
}

/** Numbers someone enters themselves instead of the formula's. */
export interface CustomTargets {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface Targets {
  /** True when the member entered their own numbers. */
  custom?: boolean
  bmr: number
  tdee: number
  calories: number
  protein_g: number
  fat_g: number
  carbs_g: number
  /** Expected loss from the 20% deficit. */
  loss_lb_per_week: number
  /** True when that loss is faster than 1% of body weight a week. */
  too_fast: boolean
  training_adjust: boolean
  /** Per-day calories/carbs after the training-day carb shift. */
  by_day: Record<Day, DayTarget>
}

const LB_TO_KG = 0.45359237
const IN_TO_CM = 2.54
const DEFICIT = 0.2
const KCAL_PER_LB = 3500
const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** Mifflin-St Jeor. */
export function bmr(p: Profile): number {
  const base = 10 * p.weight_lb * LB_TO_KG + 6.25 * p.height_in * IN_TO_CM - 5 * p.age_years
  return base + (p.sex === 'male' ? 5 : -161)
}

/**
 * @param tdeeOverride a measured TDEE from the adaptive adjustment (Phase 3);
 *   when omitted the formula estimate is used.
 */
export function computeTargets(
  p: Profile,
  schedule: Partial<Record<Day, DayType>>,
  trainingAdjust: boolean,
  tdeeOverride?: number,
): Targets {
  const b = bmr(p)
  const tdee = tdeeOverride ?? b * ACTIVITY[p.activity_level].multiplier
  const calories = tdee * (1 - DEFICIT)

  // Protein: 1 g/lb of goal weight, else 0.8 g/lb of current weight.
  const protein = p.goal_weight_lb ? p.goal_weight_lb : 0.8 * p.weight_lb
  // Fat: 0.35 g/lb, dropping toward the 0.3 g/lb floor only if carbs would go negative.
  let fat = 0.35 * p.weight_lb
  let carbs = (calories - protein * 4 - fat * 9) / 4
  if (carbs < 0) {
    fat = Math.max(0.3 * p.weight_lb, (calories - protein * 4) / 9)
    carbs = Math.max(0, (calories - protein * 4 - fat * 9) / 4)
  }

  const lossPerWeek = (tdee * DEFICIT * 7) / KCAL_PER_LB

  return {
    bmr: Math.round(b),
    tdee: Math.round(tdee),
    calories: Math.round(calories),
    protein_g: Math.round(protein),
    fat_g: Math.round(fat),
    carbs_g: Math.round(carbs),
    loss_lb_per_week: Math.round(lossPerWeek * 10) / 10,
    too_fast: lossPerWeek > 0.01 * p.weight_lb,
    training_adjust: trainingAdjust,
    by_day: dayTargets(calories, carbs, schedule, trainingAdjust),
  }
}

/**
 * Training days get +10% carbs and rest days −10%. When the week isn't evenly
 * split, the side with more days moves by less, so weekly calories never change.
 */
function dayTargets(calories: number, carbs: number, schedule: Partial<Record<Day, DayType>>, adjust: boolean) {
  const training = (d: Day) => schedule[d] === 'gym' || schedule[d] === 'home'
  const t = DAYS.filter(training).length
  const r = 7 - t
  let up = 0
  let down = 0
  if (adjust && t > 0 && r > 0) {
    if (t <= r) {
      up = 0.1
      down = (0.1 * t) / r
    } else {
      down = 0.1
      up = (0.1 * r) / t
    }
  }
  const out = {} as Record<Day, DayTarget>
  for (const d of DAYS) {
    const isTraining = training(d)
    const dc = carbs * (isTraining ? up : -down)
    out[d] = { calories: Math.round(calories + dc * 4), carbs_g: Math.round(carbs + dc), training: isTraining }
  }
  return out
}

/** Targets from the member's own numbers; the training-day carb shift still applies. */
export function customTargets(c: CustomTargets, schedule: Partial<Record<Day, DayType>>, trainingAdjust: boolean): Targets {
  return {
    custom: true,
    bmr: 0,
    tdee: 0,
    calories: Math.round(c.calories),
    protein_g: Math.round(c.protein_g),
    fat_g: Math.round(c.fat_g),
    carbs_g: Math.round(c.carbs_g),
    loss_lb_per_week: 0,
    too_fast: false,
    training_adjust: trainingAdjust,
    by_day: dayTargets(c.calories, c.carbs_g, schedule, trainingAdjust),
  }
}

/** The son's only number: grams of protein a day. */
export function childProteinTarget(weightLb: number, gramsPerLb: number): number {
  return Math.round(weightLb * gramsPerLb)
}

export function isCompleteProfile(p: Partial<Profile>): p is Profile {
  return Boolean(p.sex && p.age_years && p.height_in && p.weight_lb && p.activity_level)
}
