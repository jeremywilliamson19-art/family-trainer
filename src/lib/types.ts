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
