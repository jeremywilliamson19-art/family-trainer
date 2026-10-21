import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { offFood, scoreName, usdaFood } from './foods'
import { mealTypeForTime, recentFoods, signature, suggestedMeals, sumTotals, withPortion } from './nutrition'
import type { Food, Meal } from './types'

const usda = JSON.parse(readFileSync(new URL('../../public/foods/usda.json', import.meta.url), 'utf8'))
const find = (name: string) => usdaFood(usda.find((r: unknown[]) => r[1] === name))

const egg = find('Egg, whole, raw, fresh')
const banana = find('Bananas, raw')

describe('USDA foods', () => {
  it('default to the first household portion', () => {
    expect(egg).toMatchObject({ serving_label: '1 large', serving_g: 50, kcal: 71.5, protein: 6.3 })
  })

  it('search ranks the plain food first', () => {
    const q = ['chicken', 'breast']
    const ranked = usda
      .filter((r: unknown[]) => scoreName(r[1] as string, q) >= 0)
      .sort((a: unknown[], b: unknown[]) => scoreName(b[1] as string, q) - scoreName(a[1] as string, q))
    expect((ranked[0][1] as string).startsWith('Chicken')).toBe(true)
    expect(scoreName('Bananas, raw', ['chicken'])).toBe(-1)
  })

  it('switching portion rescales every nutrient', () => {
    const cup = withPortion(banana, '1 cup, sliced', 150)
    expect(cup).toMatchObject({ serving_g: 150, kcal: 133.5, protein: 1.7, carbs: 34.2 })
  })
})

describe('meal math', () => {
  it('totals scale with servings', () => {
    const t = sumTotals([{ food: egg, servings: 2 }, { food: banana, servings: 0.5 }])
    expect(t.protein).toBeCloseTo(6.3 * 2 + banana.protein * 0.5, 5)
    expect(t.kcal).toBeCloseTo(143 + (banana.kcal ?? 0) / 2, 5)
  })

  it('signature ignores order', () => {
    expect(signature([{ food: egg, servings: 2 }, { food: banana, servings: 1 }])).toBe(signature([{ food: banana, servings: 1 }, { food: egg, servings: 2 }]))
  })

  it('meal type follows the clock', () => {
    const at = (h: number) => mealTypeForTime(new Date(2026, 9, 21, h, 0))
    expect([at(7), at(12), at(15), at(18), at(22)]).toEqual(['breakfast', 'lunch', 'snack', 'dinner', 'snack'])
  })

  it('suggests the most frequent meal for the meal type', () => {
    const m = (id: string, items: Meal['items'], day: number, type: Meal['meal_type'] = 'breakfast'): Meal => ({
      id, member_id: 'd', date: `2026-10-${day}`, meal_type: type, items, logged_at: `2026-10-${day}T08:00:00Z`,
    })
    const eggs = [{ food: egg, servings: 2 }]
    const meals = [m('1', eggs, 10), m('2', [{ food: banana, servings: 1 }], 11), m('3', eggs, 12), m('4', eggs, 13, 'lunch')]
    const s = suggestedMeals(meals, 'breakfast')
    expect(s.map((x) => x.count)).toEqual([2, 1])
    expect(s[0].last.id).toBe('3')
    expect(recentFoods(meals).map((f) => f.id)).toEqual([egg.id, banana.id])
  })
})

describe('Open Food Facts', () => {
  it('prefers per-serving values', () => {
    const f = offFood({
      code: '0123',
      product_name: 'Core Power',
      brands: 'fairlife, Coca-Cola',
      serving_size: '1 bottle (414 ml)',
      serving_quantity: 414,
      nutriments: { 'energy-kcal_serving': 170, proteins_serving: 26, carbohydrates_serving: 8, fat_serving: 4.5, 'energy-kcal_100g': 41 },
    }) as Food
    expect(f).toMatchObject({ id: 'off:0123', brand: 'fairlife', serving_g: 414, kcal: 170, protein: 26, carbs: 8, fat: 4.5 })
  })

  it('falls back to per-100 g, and rejects products with no nutrition', () => {
    expect(offFood({ code: '1', product_name: 'Oats', nutriments: { 'energy-kcal_100g': 379, proteins_100g: 13 } })).toMatchObject({ serving_label: '100 g', kcal: 379, protein: 13 })
    expect(offFood({ code: '2', product_name: 'Mystery', nutriments: {} })).toBeNull()
  })
})

describe('USDA search', () => {
  it('never returns more than the limit, and puts everyday foods first', async () => {
    const { searchUsda } = await import('./foods')
    globalThis.fetch = (async () => ({ json: async () => usda })) as unknown as typeof fetch
    const r = await searchUsda('milk', 4)
    expect(r).toHaveLength(4)
    expect(r.map((f) => f.name)).toContain('Milk, 2%')
    expect((await searchUsda('chicken breast'))[0].name).toBe('Chicken breast, grilled')
  })
})

describe('everyday foods list', () => {
  it('every entry exists in the USDA data with its intended portion', async () => {
    const { COMMON_FOODS } = await import('./commonFoods')
    const { commonFood } = await import('./foods')
    const byId = new Map(usda.map((r: unknown[]) => [r[0], r]))
    const missing = COMMON_FOODS.filter((c) => !byId.has(c.usda)).map((c) => c.name)
    expect(missing).toEqual([])
    const noPortion = COMMON_FOODS.filter((c) => c.portion && !(byId.get(c.usda) as any)[7].some(([l]: [string]) => l.includes(c.portion!))).map((c) => c.name)
    expect(noPortion).toEqual([])
    expect(commonFood(COMMON_FOODS[0], byId.get(171534) as any)).toMatchObject({ name: 'Chicken breast, grilled', serving_label: '3 oz', serving_g: 85, protein: 25.9 })
  })
})

describe('extra nutrients', () => {
  it('USDA foods carry fiber, sugar, saturated fat and sodium per portion', () => {
    const b = withPortion(banana, '1 cup, sliced', 150)
    expect(b).toMatchObject({ fiber: 3.9, sugar: 18.3, sodium_mg: 1.5 })
  })

  it('totals add up and count items with unknown values', async () => {
    const quick: Food = { id: 'q:1', source: 'quick', name: 'Burrito', serving_label: '1 meal', serving_g: null, kcal: 900, protein: 40, carbs: null, fat: null }
    const t = sumTotals([{ food: banana, servings: 2 }, { food: quick, servings: 1 }])
    expect(t.fiber).toBeCloseTo((banana.fiber ?? 0) * 2, 5)
    expect(t.missing).toEqual({ fiber: 1, sugar: 1, sat_fat: 1, sodium_mg: 1 })
    const { nutrientGuides } = await import('./macros')
    expect(nutrientGuides(2317)).toEqual({ fiber_min_g: 32, sat_fat_max_g: 26, sodium_max_mg: 2300 })
  })

  it('Open Food Facts sodium (grams) becomes milligrams', () => {
    const f = offFood({ code: '9', product_name: 'Chips', serving_quantity: 28, nutriments: { 'energy-kcal_serving': 150, proteins_serving: 2, sodium_serving: 0.17, fiber_serving: 1, sugars_serving: 0.5, 'saturated-fat_serving': 1.5 } })
    expect(f).toMatchObject({ sodium_mg: 170, fiber: 1, sugar: 0.5, sat_fat: 1.5 })
  })
})
