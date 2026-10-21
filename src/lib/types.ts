import type { CustomTargets } from './macros'

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
  /** Own calorie/macro numbers instead of the formula (null = calculate). */
  custom_targets: CustomTargets | null
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
  /** Extra nutrients, when the source has them (null/missing = unknown). */
  fiber?: number | null
  sugar?: number | null
  sat_fat?: number | null
  sodium_mg?: number | null
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

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

export interface ProgramExercise {
  exercise_id: string
  sets: number
  rep_min: number
  rep_max: number
  /** Target effort; the son's is capped at 8. */
  rpe?: number
  rest_s: number
  /** Optional: only on some weeks / skippable (conditioning). */
  optional?: boolean
}

export interface ProgramDay {
  name: string
  exercises: ProgramExercise[]
}

export interface Program {
  id: string
  member_id: string
  /** Which starter it came from. */
  template: string
  name: string
  location: 'gym' | 'home'
  youth: boolean
  days: ProgramDay[]
  updated_at: string
}

export interface LoggedSet {
  weight: number | null
  reps: number | null
  rpe: number | null
  done: boolean
}

export interface LoggedExercise {
  exercise_id: string
  /** Rep range it was prescribed with (for progression). */
  rep_min: number
  rep_max: number
  sets: LoggedSet[]
  /** The son's sessions: a parent marks form "good" to unlock more weight. */
  form_good?: boolean | null
}

export interface Workout {
  id: string
  member_id: string
  date: string
  name: string
  location: 'gym' | 'home'
  program_id: string | null
  day_index: number | null
  started_at: string
  finished_at: string | null
  exercises: LoggedExercise[]
  notes?: string
}

// ---------------------------------------------------------------------------
// Speed & jump tests (filmed)
// ---------------------------------------------------------------------------

export interface TestRecord {
  id: string
  member_id: string
  test: 'vertical' | 'broad' | 'sprint10' | 'dash40' | 'pro_agility' | 'three_cone'
  date: string
  /** Inches (jumps) or seconds (runs). */
  value: number
  split10?: number | null
  mph?: number | null
  split_mph?: number | null
  /** Frame rate the clip was captured at (used for timing) and the file's own rate. */
  capture_fps: number | null
  file_fps: number | null
  marks: Record<string, number>
  /** Small JPEG data URL of the key frame. The video itself never leaves the phone. */
  thumbnail: string | null
  /** Form findings the parent kept, and drills suggested from them. */
  findings: { id: string; kind: 'focus' | 'good' | 'note'; title: string; detail: string }[]
  drills: string[]
  notes?: string
}
