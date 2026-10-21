// Nutrition: targets, meals, household foods and favorites (Phase 2).
// A child account never receives calorie, carb or fat numbers.
import { childProteinTarget, computeTargets, customTargets, isCompleteProfile, type Profile, type Targets } from '../../src/lib/macros'
import {
  MEAL_TYPES,
  type ChildGuardianSettings,
  type ChildTargets,
  type Favorite,
  type Food,
  type Meal,
  type MealItem,
  type MealType,
  type MemberPrivate,
  type MemberSettings,
} from '../../src/lib/types'
import { ApiError, canManage, iso, num, text, type Env, type MemberRow, type Params } from './api'

type StoredTargets = (Targets & { kind: 'adult'; computed_at: string }) | (ChildTargets & { computed_at: string })

const MAX_ITEMS = 30
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ID_RE = /^[\w:.-]{1,80}$/

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

/** Recomputes and stores a member's targets. Called after profile/settings changes. */
export function recomputeTargets(env: Env, memberId: string) {
  const m = env.store.get<MemberRow>('members', memberId)
  if (!m) return
  const priv = env.store.get<MemberPrivate>('member_private', memberId)
  if (m.role === 'child') {
    const g = env.store.get<ChildGuardianSettings>('child_guardian_settings', memberId)
    if (!priv?.weight_lb || !g) return
    env.store.put<StoredTargets>('targets', memberId, {
      kind: 'child',
      protein_g: childProteinTarget(priv.weight_lb, g.protein_g_per_lb),
      computed_at: iso(env),
    })
    return
  }
  const s = env.store.get<MemberSettings>('member_settings', memberId)
  const sched = s?.weekly_schedule ?? {}
  const adjust = s?.training_adjust ?? true
  const profile = { ...priv } as Partial<Profile>
  let t: Targets
  if (s?.custom_targets) t = customTargets(s.custom_targets, sched, adjust)
  else if (isCompleteProfile(profile)) t = computeTargets(profile, sched, adjust)
  else {
    env.store.del('targets', memberId)
    return
  }
  env.store.put<StoredTargets>('targets', memberId, { ...t, kind: 'adult', computed_at: iso(env) })
}

function getTargets(env: Env, me: MemberRow, p: Params) {
  const target = canManage(env, me, String(p.member_id ?? me.id))
  const t = env.store.get<StoredTargets>('targets', target.id)
  if (!t) return null
  // Children only ever see their protein number (guardians see the same for them).
  if (target.role === 'child') return { kind: 'child', protein_g: (t as ChildTargets).protein_g } satisfies ChildTargets
  return t
}

// ---------------------------------------------------------------------------
// Sanitizing client data
// ---------------------------------------------------------------------------

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function optNutrient(v: unknown, max: number): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > max) throw new ApiError('invalid', 'Check the nutrition numbers')
  return round1(n)
}

export function cleanFood(raw: unknown): Food {
  const f = (raw ?? {}) as Record<string, unknown>
  const id = String(f.id ?? '')
  if (!ID_RE.test(id)) throw new ApiError('invalid', 'Bad food id')
  const source = f.source
  if (source !== 'usda' && source !== 'off' && source !== 'custom' && source !== 'quick') throw new ApiError('invalid', 'Bad food source')
  const portions = Array.isArray(f.portions)
    ? (f.portions as unknown[])
        .filter((x): x is [string, number] => Array.isArray(x) && typeof x[0] === 'string' && Number(x[1]) > 0)
        .slice(0, 6)
        .map(([l, g]) => [l.slice(0, 80), round1(Number(g))] as [string, number])
    : undefined
  return {
    id,
    source,
    name: text(f.name, 160, 'food name'),
    brand: f.brand ? String(f.brand).slice(0, 80) : null,
    barcode: f.barcode ? String(f.barcode).replace(/\D/g, '').slice(0, 14) || null : null,
    serving_label: text(f.serving_label ?? '1 serving', 80, 'serving'),
    serving_g: optNutrient(f.serving_g, 5000),
    kcal: optNutrient(f.kcal, 5000),
    protein: optNutrient(f.protein, 500) ?? 0,
    carbs: optNutrient(f.carbs, 1000),
    fat: optNutrient(f.fat, 500),
    category: f.category == null ? null : Number(f.category) || null,
    ...(portions?.length ? { portions } : {}),
  }
}

function cleanItems(raw: unknown): MealItem[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new ApiError('invalid', 'Add at least one food')
  if (raw.length > MAX_ITEMS) throw new ApiError('invalid', 'That’s a lot of items. Split it into two meals.')
  return raw.map((it) => {
    const i = it as Record<string, unknown>
    return { food: cleanFood(i.food), servings: num(i.servings, 0.01, 50, 'portion') }
  })
}

function mealType(v: unknown): MealType {
  if (!MEAL_TYPES.includes(v as MealType)) throw new ApiError('invalid', 'Pick a meal')
  return v as MealType
}

/** Strips everything but protein, for anything a child account receives. */
function proteinOnlyFood(f: Food): Food {
  return { ...f, kcal: null, carbs: null, fat: null }
}
function proteinOnlyItems(items: MealItem[]): MealItem[] {
  return items.map((i) => ({ ...i, food: proteinOnlyFood(i.food) }))
}

// ---------------------------------------------------------------------------
// Meals
// ---------------------------------------------------------------------------

function listMeals(env: Env, me: MemberRow, p: Params) {
  const target = canManage(env, me, String(p.member_id ?? me.id))
  const from = DATE_RE.test(String(p.from)) ? String(p.from) : '0000-00-00'
  const to = DATE_RE.test(String(p.to)) ? String(p.to) : '9999-99-99'
  const meals = env.store
    .all<Meal>('meals')
    .filter((m) => m.member_id === target.id && m.date >= from && m.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.logged_at.localeCompare(b.logged_at))
  return me.role === 'child' ? meals.map((m) => ({ ...m, items: proteinOnlyItems(m.items) })) : meals
}

function saveMeal(env: Env, me: MemberRow, p: Params) {
  const raw = (p.meal ?? {}) as Record<string, unknown>
  const id = String(raw.id ?? '')
  if (!ID_RE.test(id)) throw new ApiError('invalid', 'Bad meal id')
  const target = canManage(env, me, String(raw.member_id ?? me.id))
  const existing = env.store.get<Meal>('meals', id)
  if (existing && existing.member_id !== target.id) throw new ApiError('forbidden', 'Not allowed')
  const date = String(raw.date ?? '')
  if (!DATE_RE.test(date)) throw new ApiError('invalid', 'Bad date')
  const meal: Meal = {
    id,
    member_id: target.id,
    date,
    meal_type: mealType(raw.meal_type),
    items: cleanItems(raw.items),
    logged_at: existing?.logged_at ?? (typeof raw.logged_at === 'string' ? raw.logged_at : iso(env)),
  }
  // Saving is idempotent by id, so the offline queue can safely retry.
  env.store.put('meals', id, meal)
  return { ok: true }
}

function deleteMeal(env: Env, me: MemberRow, p: Params) {
  const meal = env.store.get<Meal>('meals', String(p.id ?? ''))
  if (!meal) return { ok: true } // already gone (retried delete)
  canManage(env, me, meal.member_id)
  env.store.del('meals', meal.id)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Household foods (custom entries and scanned products) and favorites
// ---------------------------------------------------------------------------

type StoredFood = Food & { created_by: string; created_at: string }

function listFoods(env: Env, me: MemberRow) {
  const foods = env.store.all<StoredFood>('foods').map(({ created_by: _c, created_at: _t, ...f }) => f as Food)
  return me.role === 'child' ? foods.map(proteinOnlyFood) : foods
}

function saveFood(env: Env, me: MemberRow, p: Params) {
  const food = cleanFood(p.food)
  if (food.source !== 'custom' && food.source !== 'off') throw new ApiError('invalid', 'Only custom and scanned foods are saved')
  const existing = env.store.get<StoredFood>('foods', food.id)
  // A child's protein-only entry never overwrites full label data.
  if (existing && me.role === 'child') return { ok: true }
  env.store.put<StoredFood>('foods', food.id, { ...food, created_by: existing?.created_by ?? me.id, created_at: existing?.created_at ?? iso(env) })
  return { ok: true }
}

function listFavorites(env: Env, me: MemberRow) {
  const favs = env.store.all<Favorite>('favorites').filter((f) => f.member_id === me.id)
  return me.role === 'child' ? favs.map((f) => ({ ...f, items: proteinOnlyItems(f.items) })) : favs
}

function saveFavorite(env: Env, me: MemberRow, p: Params) {
  const raw = (p.favorite ?? {}) as Record<string, unknown>
  const id = String(raw.id ?? '')
  if (!ID_RE.test(id)) throw new ApiError('invalid', 'Bad favorite id')
  const existing = env.store.get<Favorite>('favorites', id)
  if (existing && existing.member_id !== me.id) throw new ApiError('forbidden', 'Not allowed')
  env.store.put<Favorite>('favorites', id, {
    id,
    member_id: me.id,
    name: text(raw.name, 60, 'name'),
    meal_type: mealType(raw.meal_type),
    items: cleanItems(raw.items),
  })
  return { ok: true }
}

function deleteFavorite(env: Env, me: MemberRow, p: Params) {
  const fav = env.store.get<Favorite>('favorites', String(p.id ?? ''))
  if (fav && fav.member_id === me.id) env.store.del('favorites', fav.id)
  return { ok: true }
}

/** Everything the log screen needs, in one round trip (Apps Script calls are slow). */
function nutritionSync(env: Env, me: MemberRow, p: Params) {
  return {
    targets: getTargets(env, me, {}),
    meals: listMeals(env, me, { from: p.from }),
    foods: listFoods(env, me),
    favorites: listFavorites(env, me),
  }
}

export const NUTRITION_AUTHED: Record<string, (env: Env, me: MemberRow, p: Params) => unknown> = {
  getTargets,
  listMeals,
  saveMeal,
  deleteMeal,
  listFoods,
  saveFood,
  listFavorites,
  saveFavorite,
  deleteFavorite,
  nutritionSync,
}
