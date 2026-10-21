// Turning a program day into today's workout.
import { exercise } from '../../lib/exercises'
import { localDate } from '../../lib/nutrition'
import { newId } from '../../lib/syncStore'
import { advise, liftsThisWeek, prefillSets, youthDayPlan, type DayPlan } from '../../lib/training'
import type { YouthLimits } from '../../lib/trainingStore'
import { DAYS, type DayType, type MemberSettings, type Program, type ProgramDay, type Workout } from '../../lib/types'

const JS_DAY_TO_KEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export function todayType(settings: MemberSettings | null): DayType {
  const key = JS_DAY_TO_KEY[new Date().getDay()]
  return (settings?.weekly_schedule?.[key] as DayType | undefined) ?? 'rest'
}

export const dayOrder = DAYS

/** The program for a location: newest one there, else any. */
export function programFor(programs: Program[], location: 'gym' | 'home'): Program | null {
  const sorted = [...programs].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  return sorted.find((p) => p.location === location) ?? sorted[0] ?? null
}

/** The day as it should be done today (youth guardrails applied for the son). */
export function planDay(program: Program, day: ProgramDay, workouts: Workout[], limits: YouthLimits | null): DayPlan {
  if (!program.youth || !limits) return { exercises: day.exercises, notes: [] }
  return youthDayPlan(day, {
    inSeason: limits.in_season,
    liftsThisWeek: liftsThisWeek(workouts, localDate()),
    contactCap: limits.foot_contact_cap,
  })
}

export function newWorkout(opts: {
  memberId: string
  name: string
  location: 'gym' | 'home'
  program: Program | null
  dayIndex: number | null
  plan: DayPlan | null
  workouts: Workout[]
  youth: boolean
}): Workout {
  return {
    id: newId(),
    member_id: opts.memberId,
    date: localDate(),
    name: opts.name,
    location: opts.location,
    program_id: opts.program?.id ?? null,
    day_index: opts.dayIndex,
    started_at: new Date().toISOString(),
    finished_at: null,
    exercises: (opts.plan?.exercises ?? [])
      .filter((pe) => !pe.optional)
      .map((pe) => ({
        exercise_id: pe.exercise_id,
        rep_min: pe.rep_min,
        rep_max: pe.rep_max,
        sets: prefillSets(pe, opts.workouts, advise(pe.exercise_id, opts.workouts, opts.youth)),
      })),
  }
}

/** Prescription shown under an exercise name: "3 × 8–12 · rest 90 s". */
export function prescription(sets: number, repMin: number, repMax: number, exerciseId: string, rest?: number): string {
  const unit = exercise(exerciseId).unit
  const range = repMin === repMax ? `${repMin}` : `${repMin}–${repMax}`
  const what = unit === 'sec' ? `${range} sec` : unit === 'yd' ? `${range} yd` : unit === 'min' ? `${range} min` : range
  return `${sets} × ${what}${rest ? ` · rest ${rest >= 60 ? `${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}` : `${rest} s`}` : ''}`
}
