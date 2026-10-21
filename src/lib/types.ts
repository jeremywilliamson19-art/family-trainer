export type Role = 'admin' | 'adult' | 'child'
export type DayType = 'gym' | 'home' | 'rest'
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Day = (typeof DAYS)[number]

export interface Member {
  id: string
  household_id: string
  role: Role
  display_name: string
  guardian_id: string | null
  sports: string[]
  in_season: boolean
  timezone: string
  onboarded_at: string | null
}

export interface MemberSettings {
  member_id: string
  track_food: boolean
  track_workouts: boolean
  feed_workouts: boolean
  feed_prs: boolean
  feed_test_bests: boolean
  feed_streaks: boolean
  feed_body: boolean
  dislikes: string[]
  weekly_schedule: Partial<Record<Day, DayType>>
  home_equipment: string[]
  /** +10% carbs on training days, −10% on rest days. */
  training_adjust: boolean
}

export interface MemberPrivate {
  member_id: string
  sex: 'male' | 'female' | null
  age_years: number | null
  height_in: number | null
  weight_lb: number | null
  goal_weight_lb: number | null
  activity_level: string | null
}

export interface ChildGuardianSettings {
  child_id: string
  protein_g_per_lb: number
  foot_contact_cap: number
  test_reminder_weeks: number
}

// ---------------------------------------------------------------------------
// Nutrition (Phase 2)
// ---------------------------------------------------------------------------

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

/**
 * A food as logged: nutrients are per serving. Logged meals keep a copy, so
 * later edits to a food never change history.
 */
export interface Food {
  /** usda:<fdc_id> | off:<barcode> | c:<uuid> | q:<uuid> */
  id: string
  source: 'usda' | 'off' | 'custom' | 'quick'
  name: string
  brand?: string | null
  barcode?: string | null
  serving_label: string
  /** Grams in one serving; null when unknown (grams/ounces entry disabled). */
  serving_g: number | null
  kcal: number | null
  protein: number
  carbs: number | null
  fat: number | null
  /** USDA food group, used later for dislike filtering (16 = legumes). */
  category?: number | null
  /** Alternate portions [label, grams], from USDA. */
  portions?: [string, number][]
}

export interface MealItem {
  food: Food
  servings: number
}

export interface Meal {
  id: string
  member_id: string
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  meal_type: MealType
  items: MealItem[]
  logged_at: string
}

export interface Favorite {
  id: string
  member_id: string
  name: string
  meal_type: MealType
  items: MealItem[]
}

/** What a child account gets instead of full targets. */
export interface ChildTargets {
  kind: 'child'
  protein_g: number
}
