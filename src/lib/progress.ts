// Progress from the logs: workout counts and streaks, body trend, lift and
// test progress from baseline. Pure functions for the Progress screen.
import { better, TEST_BY_ID } from './agility'
import { exercise } from './exercises'
import { addDays } from './nutrition'
import { e1rm, weekStart } from './training'
import type { Measurement, TestRecord, Workout } from './types'

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

export interface WorkoutStats {
  total: number
  thisWeek: number
  thisMonth: number
  /** Consecutive weeks (ending this week or last) with at least one workout. */
  streakWeeks: number
  firstDate: string | null
  /** Workouts per week, oldest first. */
  perWeek: { week: string; count: number }[]
  /** Workouts per calendar month, newest first. */
  perMonth: { month: string; count: number }[]
}

const done = (ws: Workout[]) => ws.filter((w) => w.finished_at)

export function workoutStats(workouts: Workout[], today: string, weeks = 12): WorkoutStats {
  const ws = done(workouts)
  const monday = weekStart(today)
  const byWeek = new Map<string, number>()
  const byMonth = new Map<string, number>()
  for (const w of ws) {
    byWeek.set(weekStart(w.date), (byWeek.get(weekStart(w.date)) ?? 0) + 1)
    byMonth.set(w.date.slice(0, 7), (byMonth.get(w.date.slice(0, 7)) ?? 0) + 1)
  }
  // A week in progress with no workout yet doesn't break the streak.
  let streak = 0
  let wk = byWeek.has(monday) ? monday : addDays(monday, -7)
  while (byWeek.has(wk)) {
    streak++
    wk = addDays(wk, -7)
  }
  return {
    total: ws.length,
    thisWeek: byWeek.get(monday) ?? 0,
    thisMonth: byMonth.get(today.slice(0, 7)) ?? 0,
    streakWeeks: streak,
    firstDate: ws.length ? ws.map((w) => w.date).sort()[0] : null,
    perWeek: Array.from({ length: weeks }, (_, i) => {
      const w = addDays(monday, -7 * (weeks - 1 - i))
      return { week: w, count: byWeek.get(w) ?? 0 }
    }),
    perMonth: [...byMonth.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([month, count]) => ({ month, count })),
  }
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

export interface TrendPoint {
  date: string
  value: number
  /** Average of entries in the 7 days up to and including this date. */
  trend: number
}

/** A measurement series with its 7-day moving average. */
export function series(ms: Measurement[], key: 'weight_lb' | 'waist_in' | 'chest_in' | 'height_in'): TrendPoint[] {
  const pts = ms
    .filter((m) => typeof m[key] === 'number')
    .map((m) => ({ date: m.date, value: m[key] as number }))
    .sort((a, b) => a.date.localeCompare(b.date))
  return pts.map((p) => {
    const from = addDays(p.date, -6)
    const win = pts.filter((q) => q.date >= from && q.date <= p.date)
    return { ...p, trend: win.reduce((n, q) => n + q.value, 0) / win.length }
  })
}

export interface Change {
  baseline: { date: string; value: number }
  current: { date: string; value: number }
  change: number
  pct: number
}

/** Baseline = first entry; current = latest 7-day trend (weight) or latest value. */
export function bodyChange(points: TrendPoint[], useTrend = true): Change | null {
  if (!points.length) return null
  const first = points[0]
  const last = points[points.length - 1]
  const current = useTrend ? last.trend : last.value
  return {
    baseline: { date: first.date, value: first.value },
    current: { date: last.date, value: current },
    change: current - first.value,
    pct: ((current - first.value) / first.value) * 100,
  }
}

/** Share of the way from the starting weight to the goal (0–100). */
export function goalProgress(start: number, current: number, goal: number | null): number | null {
  if (!goal || goal === start) return null
  return Math.max(0, Math.min(100, ((start - current) / (start - goal)) * 100))
}

// ---------------------------------------------------------------------------
// Lifts
// ---------------------------------------------------------------------------

export interface LiftProgress {
  exercise_id: string
  name: string
  main: boolean
  /** What's being compared: estimated max (adults), heaviest weight (kids), or reps (bodyweight). */
  measure: 'e1rm' | 'weight' | 'reps'
  baseline: { date: string; value: number; label: string }
  best: { date: string; value: number; label: string }
  latest: { date: string; value: number; label: string }
  change: number
  pct: number
  sessions: number
  /** Best per session, oldest first (for the chart). */
  history: { date: string; value: number }[]
}

/**
 * For every weighted or bodyweight strength exercise: the first session's
 * best set (baseline), the best ever, and the latest, measured the same way.
 */
export function liftProgress(workouts: Workout[], youth: boolean): LiftProgress[] {
  const by = new Map<string, { date: string; value: number; label: string }[]>()
  for (const w of done(workouts).sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of w.exercises) {
      const ex = exercise(e.exercise_id)
      if (ex.kind !== 'strength' && ex.kind !== 'core') continue
      const sets = e.sets.filter((s) => s.done && (s.reps ?? 0) > 0)
      if (!sets.length) continue
      const weighted = ex.load !== 'bodyweight' && sets.some((s) => (s.weight ?? 0) > 0)
      let pick: { value: number; label: string }
      if (weighted && !youth) {
        const top = sets.reduce((a, b) => (e1rm(b.weight ?? 0, b.reps ?? 0) > e1rm(a.weight ?? 0, a.reps ?? 0) ? b : a))
        pick = { value: Math.round(e1rm(top.weight ?? 0, top.reps ?? 0)), label: `${top.weight} lb × ${top.reps}` }
      } else if (weighted) {
        const top = sets.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) || ((b.weight ?? 0) === (a.weight ?? 0) && (b.reps ?? 0) > (a.reps ?? 0)) ? b : a))
        pick = { value: top.weight ?? 0, label: `${top.weight} lb × ${top.reps}` }
      } else {
        const top = Math.max(...sets.map((s) => s.reps ?? 0))
        pick = { value: top, label: `${top} ${ex.unit === 'sec' ? 'sec' : 'reps'}` }
      }
      const list = by.get(e.exercise_id) ?? []
      // One point per session day (best of the day).
      const same = list.find((p) => p.date === w.date)
      if (same) {
        if (pick.value > same.value) Object.assign(same, pick)
      } else list.push({ date: w.date, ...pick })
      by.set(e.exercise_id, list)
    }
  }
  const out: LiftProgress[] = []
  for (const [id, list] of by) {
    const ex = exercise(id)
    const weighted = ex.load !== 'bodyweight' && list.some((p) => p.label.includes('lb'))
    const baseline = list[0]
    const latest = list[list.length - 1]
    const best = list.reduce((a, b) => (b.value > a.value ? b : a))
    out.push({
      exercise_id: id,
      name: ex.name,
      main: !!ex.main,
      measure: weighted ? (youth ? 'weight' : 'e1rm') : 'reps',
      baseline,
      best,
      latest,
      change: best.value - baseline.value,
      pct: baseline.value ? ((best.value - baseline.value) / baseline.value) * 100 : 0,
      sessions: list.length,
      history: list.map(({ date, value }) => ({ date, value })),
    })
  }
  // Main lifts first, then most-trained.
  return out.sort((a, b) => Number(b.main) - Number(a.main) || b.sessions - a.sessions || a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------------------
// Speed & jump tests
// ---------------------------------------------------------------------------

export interface TestProgress {
  test: TestRecord['test']
  baseline: TestRecord
  best: TestRecord
  latest: TestRecord
  /** Improvement from baseline to best, in the test's unit (positive = better). */
  improvement: number
  count: number
}

export function testProgress(tests: TestRecord[]): TestProgress[] {
  const by = new Map<TestRecord['test'], TestRecord[]>()
  for (const t of [...tests].sort((a, b) => a.date.localeCompare(b.date))) by.set(t.test, [...(by.get(t.test) ?? []), t])
  return [...by.entries()].map(([test, list]) => {
    const def = TEST_BY_ID.get(test)!
    const best = list.reduce((a, b) => (better(def, b.value, a.value) ? b : a))
    return {
      test,
      baseline: list[0],
      best,
      latest: list[list.length - 1],
      improvement: def.higherIsBetter ? best.value - list[0].value : list[0].value - best.value,
      count: list.length,
    }
  })
}
