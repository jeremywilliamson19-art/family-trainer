// Pure helpers for meals: totals, portions, meal-type defaults, suggestions.
import type { Food, Meal, MealItem, MealType } from './types'

export interface Totals {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sat_fat: number
  sodium_mg: number
  /** Items with no value for each extra nutrient (their totals are undercounts). */
  missing: { fiber: number; sugar: number; sat_fat: number; sodium_mg: number }
}

const EXTRA = ['fiber', 'sugar', 'sat_fat', 'sodium_mg'] as const

export const ZERO: Totals = {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  sat_fat: 0,
  sodium_mg: 0,
  missing: { fiber: 0, sugar: 0, sat_fat: 0, sodium_mg: 0 },
}

export function itemTotals(i: MealItem): Totals {
  const t: Totals = {
    kcal: (i.food.kcal ?? 0) * i.servings,
    protein: i.food.protein * i.servings,
    carbs: (i.food.carbs ?? 0) * i.servings,
    fat: (i.food.fat ?? 0) * i.servings,
    fiber: 0,
    sugar: 0,
    sat_fat: 0,
    sodium_mg: 0,
    missing: { fiber: 0, sugar: 0, sat_fat: 0, sodium_mg: 0 },
  }
  for (const k of EXTRA) {
    const v = i.food[k]
    if (v === null || v === undefined) t.missing[k] = 1
    else t[k] = v * i.servings
  }
  return t
}

export function sumTotals(items: MealItem[]): Totals {
  return items.map(itemTotals).reduce(
    (a, b) => ({
      kcal: a.kcal + b.kcal,
      protein: a.protein + b.protein,
      carbs: a.carbs + b.carbs,
      fat: a.fat + b.fat,
      fiber: a.fiber + b.fiber,
      sugar: a.sugar + b.sugar,
      sat_fat: a.sat_fat + b.sat_fat,
      sodium_mg: a.sodium_mg + b.sodium_mg,
      missing: {
        fiber: a.missing.fiber + b.missing.fiber,
        sugar: a.missing.sugar + b.missing.sugar,
        sat_fat: a.missing.sat_fat + b.missing.sat_fat,
        sodium_mg: a.missing.sodium_mg + b.missing.sodium_mg,
      },
    }),
    ZERO,
  )
}

export function dayTotals(meals: Meal[]): Totals {
  return sumTotals(meals.flatMap((m) => m.items))
}

/** Re-expresses a food per a different portion (e.g. "1 cup" instead of "100 g"). */
export function withPortion(food: Food, label: string, grams: number): Food {
  if (!food.serving_g) return food
  const k = grams / food.serving_g
  const scale = (v: number | null) => (v === null ? null : Math.round(v * k * 10) / 10)
  return {
    ...food,
    serving_label: label,
    serving_g: grams,
    kcal: scale(food.kcal),
    protein: Math.round(food.protein * k * 10) / 10,
    carbs: scale(food.carbs),
    fat: scale(food.fat),
    fiber: scale(food.fiber ?? null),
    sugar: scale(food.sugar ?? null),
    sat_fat: scale(food.sat_fat ?? null),
    sodium_mg: scale(food.sodium_mg ?? null),
  }
}

export const OZ_TO_G = 28.349523125

/** Local calendar date as YYYY-MM-DD. */
export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return localDate(new Date(y, m - 1, d + n))
}

/** Default meal type from the time of day. */
export function mealTypeForTime(d = new Date()): MealType {
  const h = d.getHours() + d.getMinutes() / 60
  if (h >= 4 && h < 10.5) return 'breakfast'
  if (h >= 10.5 && h < 14.5) return 'lunch'
  if (h >= 16.5 && h < 21) return 'dinner'
  return 'snack'
}

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

/** Identifies "the same meal": same foods in the same amounts, in any order. */
export function signature(items: MealItem[]): string {
  return items
    .map((i) => `${i.food.id}×${Math.round(i.servings * 100) / 100}`)
    .sort()
    .join('|')
}

export interface Suggestion {
  signature: string
  items: MealItem[]
  count: number
  /** The most recent time this meal was logged. */
  last: Meal
}

/**
 * The member's most frequent meals for a meal type, most frequent first;
 * ties go to the most recent. Uses the newest copy's food data.
 */
export function suggestedMeals(meals: Meal[], type: MealType, limit = 3): Suggestion[] {
  const by = new Map<string, Suggestion>()
  for (const m of meals) {
    if (m.meal_type !== type) continue
    const sig = signature(m.items)
    const s = by.get(sig)
    if (!s) by.set(sig, { signature: sig, items: m.items, count: 1, last: m })
    else {
      s.count++
      if (m.logged_at > s.last.logged_at) {
        s.last = m
        s.items = m.items
      }
    }
  }
  return [...by.values()]
    .sort((a, b) => b.count - a.count || b.last.logged_at.localeCompare(a.last.logged_at))
    .slice(0, limit)
}

/** Distinct foods from recent meals, newest first. */
export function recentFoods(meals: Meal[], limit = 30): Food[] {
  const seen = new Set<string>()
  const out: Food[] = []
  for (const m of [...meals].sort((a, b) => b.logged_at.localeCompare(a.logged_at))) {
    for (const i of m.items) {
      if (seen.has(i.food.id)) continue
      seen.add(i.food.id)
      out.push(i.food)
      if (out.length >= limit) return out
    }
  }
  return out
}

/** A short name for a meal: "Eggs, toast + 1 more". */
export function mealName(items: MealItem[]): string {
  const names = items.map((i) => i.food.name.split(',')[0])
  return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} + ${names.length - 2} more`
}

export function fmtServings(n: number): string {
  if (n === 0.5) return '½'
  if (n === 1.5) return '1½'
  return String(Math.round(n * 100) / 100)
}
