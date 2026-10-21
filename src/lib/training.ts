// Training rules (spec section 8): progression, PRs, weekly volume,
// plateaus, and the youth guardrails. Pure functions, shared by the app
// and the tests.
import { exercise, type Exercise, type Muscle } from './exercises'
import { addDays } from './nutrition'
import type { LoggedExercise, LoggedSet, Program, ProgramDay, ProgramExercise, Workout } from './types'

export const ARM_MIN_SETS = 12

/** Epley estimated one-rep max. */
export function e1rm(weight: number, reps: number): number {
  return reps <= 1 ? weight : weight * (1 + reps / 30)
}

const doneSets = (e: LoggedExercise) => e.sets.filter((s) => s.done && (s.reps ?? 0) > 0)
const totalReps = (e: LoggedExercise) => doneSets(e).reduce((n, s) => n + (s.reps ?? 0), 0)
const topWeight = (e: LoggedExercise) => Math.max(0, ...doneSets(e).map((s) => s.weight ?? 0))

/** Monday of the week containing `date` (YYYY-MM-DD). */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7 // Mon = 0
  return addDays(date, -dow)
}

/** Finished workouts, newest first. */
function finished(workouts: Workout[]): Workout[] {
  return workouts.filter((w) => w.finished_at).sort((a, b) => b.date.localeCompare(a.date) || (b.started_at ?? '').localeCompare(a.started_at ?? ''))
}

/** Each past session of one exercise, newest first, with its date. */
export function sessionsOf(exerciseId: string, workouts: Workout[]): (LoggedExercise & { date: string })[] {
  const out: (LoggedExercise & { date: string })[] = []
  for (const w of finished(workouts)) {
    for (const e of w.exercises) if (e.exercise_id === exerciseId && doneSets(e).length) out.push({ ...e, date: w.date })
  }
  return out
}

// ---------------------------------------------------------------------------
// Weekly volume
// ---------------------------------------------------------------------------

/** A set that counts toward volume: a completed strength or core set. */
function isWorkingSet(s: LoggedSet, ex: Exercise): boolean {
  return s.done && (s.reps ?? 0) > 0 && (ex.kind === 'strength' || ex.kind === 'core')
}

/** Working sets per muscle for the week starting `monday`. Secondary muscles count half. */
export function weeklyVolume(workouts: Workout[], monday: string): Partial<Record<Muscle, number>> {
  const sunday = addDays(monday, 6)
  const vol: Partial<Record<Muscle, number>> = {}
  for (const w of workouts) {
    if (w.date < monday || w.date > sunday) continue
    for (const e of w.exercises) {
      const ex = exercise(e.exercise_id)
      const n = e.sets.filter((s) => isWorkingSet(s, ex)).length
      if (!n) continue
      for (const m of ex.primary) vol[m] = (vol[m] ?? 0) + n
      for (const m of ex.secondary ?? []) vol[m] = (vol[m] ?? 0) + n / 2
    }
  }
  return vol
}

/** Biceps/triceps under 12 hard sets this week. */
export function armWarnings(vol: Partial<Record<Muscle, number>>): string[] {
  return (['triceps', 'biceps'] as const)
    .filter((m) => (vol[m] ?? 0) < ARM_MIN_SETS)
    .map((m) => `${m === 'triceps' ? 'Triceps' : 'Biceps'}: ${Math.floor(vol[m] ?? 0)} of ${ARM_MIN_SETS} sets this week`)
}

// ---------------------------------------------------------------------------
// Progression (double progression from the numbers alone; youth: reps
// first, weight only after a parent marks form good)
// ---------------------------------------------------------------------------

export type AdviceKind = 'new' | 'add_weight' | 'add_reps' | 'hold' | 'fatigue' | 'form_check'

export interface Advice {
  kind: AdviceKind
  text: string
  /** Suggested working weight for today, if it's a weighted lift. */
  weight: number | null
}

/** How much weight to add. Spec: +5 lb dumbbells/cables (upper), +5–10 lb barbell. */
export function increment(ex: Exercise, youth: boolean): number {
  if (youth) return ex.load === 'barbell' || ex.load === 'machine' ? 5 : 2.5
  if (ex.load === 'barbell') return ex.lower ? 10 : 5
  return 5
}

export function advise(exerciseId: string, workouts: Workout[], youth: boolean): Advice {
  const ex = exercise(exerciseId)
  const [last, prev, prev2] = sessionsOf(exerciseId, workouts)
  if (!last) {
    return {
      kind: 'new',
      text: youth
        ? 'First time: start light and focus on perfect form.'
        : 'First time: pick a weight you could do for the top of the range with 2–3 reps left.',
      weight: null,
    }
  }
  const sets = doneSets(last)
  const w = topWeight(last)
  const weighted = w > 0 && ex.load !== 'bodyweight'
  const atTop = sets.length > 0 && sets.every((s) => (s.reps ?? 0) >= last.rep_max)
  const lastText = `Last time: ${sets.map((s) => s.reps).join(', ')} reps${weighted ? ` at ${w} lb` : ''}.`

  if (youth) {
    if (atTop && weighted) {
      return last.form_good
        ? { kind: 'add_weight', text: `${lastText} Form checked ✓. Add ${increment(ex, true)} lb.`, weight: w + increment(ex, true) }
        : { kind: 'form_check', text: `${lastText} Top of the range! A parent marks form “good” before adding weight.`, weight: w }
    }
    return { kind: 'add_reps', text: `${lastText} Try one more rep per set.`, weight: weighted ? w : null }
  }

  // Reps falling two sessions in a row at the same (or less) weight.
  if (prev && prev2 && totalReps(last) < totalReps(prev) && totalReps(prev) < totalReps(prev2) && topWeight(last) <= topWeight(prev) && topWeight(prev) <= topWeight(prev2)) {
    return { kind: 'fatigue', text: `${lastText} Reps have dropped two sessions in a row. Possible fatigue: sleep, food, or a lighter week.`, weight: weighted ? w : null }
  }
  if (atTop) {
    if (!weighted) return { kind: 'add_reps', text: `${lastText} Top of the range. Add reps or a harder variation.`, weight: null }
    return { kind: 'add_weight', text: `${lastText} All sets hit ${last.rep_max}. Add ${increment(ex, false)} lb.`, weight: w + increment(ex, false) }
  }
  if (prev && totalReps(last) === totalReps(prev) && topWeight(last) === topWeight(prev)) {
    return { kind: 'hold', text: `${lastText} Same as the time before. Hold the weight and fight for one more rep.`, weight: weighted ? w : null }
  }
  return { kind: 'add_reps', text: `${lastText} Beat it by a rep.`, weight: weighted ? w : null }
}

/**
 * Applies an edit to set `si`, carrying a typed weight or rep count down to
 * later sets that are still following along (blank, or equal to what this
 * set was). Later sets changed by hand, and finished sets, keep their values.
 */
export function carryForward(sets: LoggedSet[], si: number, patch: Partial<LoggedSet>): LoggedSet[] {
  const before = sets[si]
  return sets.map((s, j) => {
    if (j === si) return { ...s, ...patch }
    if (j < si || s.done) return s
    const next = { ...s }
    for (const k of ['weight', 'reps'] as const) {
      if (k in patch && (s[k] === null || s[k] === before[k])) next[k] = patch[k] ?? null
    }
    return next
  })
}

/** Sets to start today's exercise with, from last time (weights filled in). */
export function prefillSets(pe: Pick<ProgramExercise, 'exercise_id' | 'sets'>, workouts: Workout[], advice: Advice): LoggedSet[] {
  const last = sessionsOf(pe.exercise_id, workouts)[0]
  return Array.from({ length: pe.sets }, (_, i) => ({
    weight: advice.weight ?? last?.sets[i]?.weight ?? last?.sets[0]?.weight ?? null,
    reps: null,
    rpe: null,
    done: false,
  }))
}

// ---------------------------------------------------------------------------
// PRs and plateaus
// ---------------------------------------------------------------------------

export interface PR {
  exercise_id: string
  text: string
}

/**
 * New bests in a workout vs everything before it. Adults: estimated max
 * (e1RM) for weighted lifts. Kids: heaviest weight or most reps in a set,
 * never a max estimate.
 */
export function findPRs(workout: Workout, history: Workout[], youth: boolean): PR[] {
  const before = history.filter((w) => w.id !== workout.id && w.finished_at && w.date <= workout.date)
  const out: PR[] = []
  for (const e of workout.exercises) {
    const sets = doneSets(e)
    if (!sets.length) continue
    const ex = exercise(e.exercise_id)
    if (ex.kind === 'conditioning') continue
    const past = sessionsOf(e.exercise_id, before)
    if (!past.length) continue // first time isn't a PR
    const pastSets = past.flatMap(doneSets)
    const weighted = ex.load !== 'bodyweight' && sets.some((s) => (s.weight ?? 0) > 0)
    if (weighted && !youth) {
      const best = Math.max(...sets.map((s) => e1rm(s.weight ?? 0, s.reps ?? 0)))
      const prevBest = Math.max(0, ...pastSets.map((s) => e1rm(s.weight ?? 0, s.reps ?? 0)))
      if (best > prevBest + 0.01) {
        const top = sets.reduce((a, b) => (e1rm(b.weight ?? 0, b.reps ?? 0) > e1rm(a.weight ?? 0, a.reps ?? 0) ? b : a))
        out.push({ exercise_id: e.exercise_id, text: `${ex.name}: ${top.weight} lb × ${top.reps} (new best, est. max ${Math.round(best)} lb)` })
      }
    } else if (weighted) {
      const heaviest = Math.max(...sets.map((s) => s.weight ?? 0))
      if (heaviest > Math.max(0, ...pastSets.map((s) => s.weight ?? 0))) out.push({ exercise_id: e.exercise_id, text: `${ex.name}: ${heaviest} lb, heaviest yet` })
    } else {
      const most = Math.max(...sets.map((s) => s.reps ?? 0))
      if (most > Math.max(0, ...pastSets.map((s) => s.reps ?? 0))) {
        out.push({ exercise_id: e.exercise_id, text: `${ex.name}: ${most} ${ex.unit === 'sec' ? 'seconds' : 'reps'}, most yet` })
      }
    }
  }
  return out
}

/** Best estimated max per week for a lift, oldest week first. */
export function weeklyBest(exerciseId: string, workouts: Workout[]): { week: string; e1rm: number }[] {
  const by = new Map<string, number>()
  for (const s of sessionsOf(exerciseId, workouts)) {
    const best = Math.max(...doneSets(s).map((x) => e1rm(x.weight ?? 0, x.reps ?? 0)))
    const wk = weekStart(s.date)
    by.set(wk, Math.max(by.get(wk) ?? 0, best))
  }
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, v]) => ({ week, e1rm: v }))
}

/**
 * Plateau: a main lift's estimated max hasn't beaten its earlier best for
 * the last 3+ weeks (needs at least 4 weeks of history).
 */
export function plateau(exerciseId: string, workouts: Workout[], today: string): string | null {
  const ex = exercise(exerciseId)
  if (!ex.main) return null
  const weeks = weeklyBest(exerciseId, workouts)
  const cutoff = addDays(weekStart(today), -14) // this week and the two before
  const recent = weeks.filter((w) => w.week >= cutoff)
  const earlier = weeks.filter((w) => w.week < cutoff)
  if (recent.length < 2 || !earlier.length) return null
  const earlierBest = Math.max(...earlier.map((w) => w.e1rm))
  if (Math.max(...recent.map((w) => w.e1rm)) > earlierBest * 1.01) return null
  return `${ex.name} has been flat for 3+ weeks. Try one change: a different variation, a new rep range (e.g. 5–8 or 12–15), or a deload week at ~60% volume.`
}

// ---------------------------------------------------------------------------
// Youth guardrails
// ---------------------------------------------------------------------------

/** Foot contacts in a list of prescribed or logged exercises. */
export function footContacts(items: (ProgramExercise | LoggedExercise)[], logged = false): number {
  let n = 0
  for (const it of items) {
    const ex = exercise(it.exercise_id)
    if (!ex.contacts) continue
    if (logged) n += doneSets(it as LoggedExercise).reduce((a, s) => a + (s.reps ?? 0), 0) * ex.contacts
    else n += (it as ProgramExercise).sets * (it as ProgramExercise).rep_max * ex.contacts
  }
  return n
}

export interface DayPlan {
  exercises: ProgramExercise[]
  notes: string[]
}

/**
 * The son's session for today, with the guardrails enforced: landing drills
 * before big jumps, foot contacts under the parent's cap, and in-season cuts
 * (−40% sets, lifting at most 2 days a week).
 */
export function youthDayPlan(day: ProgramDay, opts: { inSeason: boolean; liftsThisWeek: number; contactCap: number }): DayPlan {
  const notes: string[] = []
  let list = day.exercises.map((e) => ({ ...e }))

  const isLift = (e: ProgramExercise) => exercise(e.exercise_id).kind === 'strength'
  if (opts.inSeason) {
    list = list.map((e) => ({ ...e, sets: Math.max(1, Math.round(e.sets * 0.6)) }))
    notes.push('In season: about 40% less volume.')
    if (opts.liftsThisWeek >= 2 && list.some(isLift)) {
      list = list.filter((e) => !isLift(e))
      notes.push('Already lifted twice this week, so today is jumps and speed only.')
    }
  }

  // Landing drills always come before the higher-intensity jumps.
  const landing = list.filter((e) => exercise(e.exercise_id).kind === 'landing')
  const firstBig = list.findIndex((e) => exercise(e.exercise_id).highIntensity)
  if (landing.length && firstBig >= 0 && list.findIndex((e) => exercise(e.exercise_id).kind === 'landing') > firstBig) {
    list = [...landing, ...list.filter((e) => exercise(e.exercise_id).kind !== 'landing')]
  }

  // Trim jump sets (big jumps first, from the end) until under the cap.
  let contacts = footContacts(list)
  if (contacts > opts.contactCap) {
    const order = [...list.keys()].filter((i) => exercise(list[i].exercise_id).contacts).sort((a, b) => {
      const hi = Number(!!exercise(list[b].exercise_id).highIntensity) - Number(!!exercise(list[a].exercise_id).highIntensity)
      return hi || b - a
    })
    for (const i of order) {
      while (contacts > opts.contactCap && list[i].sets > 1) {
        list[i] = { ...list[i], sets: list[i].sets - 1 }
        contacts = footContacts(list)
      }
    }
    for (const i of order) {
      if (contacts <= opts.contactCap) break
      if (exercise(list[i].exercise_id).kind === 'landing') continue
      list[i] = { ...list[i], sets: 0 }
      contacts = footContacts(list)
    }
    list = list.filter((e) => e.sets > 0)
    notes.push(`Jumps trimmed to stay under ${opts.contactCap} foot contacts.`)
  }
  return { exercises: list, notes }
}

/** The program day to do next: the one after the last session of this program. */
export function nextDayIndex(program: Program, workouts: Workout[]): number {
  const last = finished(workouts).find((w) => w.program_id === program.id && w.day_index !== null)
  return last ? (last.day_index! + 1) % program.days.length : 0
}

/** Lifting sessions (any strength work) this week, for the in-season limit. */
export function liftsThisWeek(workouts: Workout[], today: string): number {
  const monday = weekStart(today)
  return finished(workouts).filter((w) => w.date >= monday && w.date <= today && w.exercises.some((e) => exercise(e.exercise_id).kind === 'strength' && doneSets(e).length)).length
}
