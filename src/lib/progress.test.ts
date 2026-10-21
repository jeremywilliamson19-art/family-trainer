import { describe, expect, it } from 'vitest'
import { bodyChange, goalProgress, liftProgress, series, testProgress, workoutStats } from './progress'
import type { Measurement, TestRecord, Workout } from './types'

let n = 0
const w = (date: string, exercise_id = 'bench_press', sets: [number, number][] = [[185, 8]], finished = true): Workout => ({
  id: `w${++n}`,
  member_id: 'm',
  date,
  name: 'x',
  location: 'gym',
  program_id: null,
  day_index: null,
  started_at: `${date}T10:00:00Z`,
  finished_at: finished ? `${date}T11:00:00Z` : null,
  exercises: [{ exercise_id, rep_min: 6, rep_max: 10, sets: sets.map(([weight, reps]) => ({ weight, reps, rpe: null, done: true })) }],
})

describe('workout log', () => {
  it('counts totals, this week/month and the weekly streak', () => {
    // Today is Wed 2026-10-21; weeks start Monday.
    const ws = [w('2026-09-28'), w('2026-10-05'), w('2026-10-07'), w('2026-10-12'), w('2026-10-20'), w('2026-10-21'), w('2026-10-21', 'x', [], false)]
    const s = workoutStats(ws, '2026-10-21')
    expect(s).toMatchObject({ total: 6, thisWeek: 2, thisMonth: 5, streakWeeks: 4, firstDate: '2026-09-28' })
    expect(s.perWeek.at(-1)).toEqual({ week: '2026-10-19', count: 2 })
    expect(s.perMonth).toEqual([{ month: '2026-10', count: 5 }, { month: '2026-09', count: 1 }])
  })

  it('a week in progress without a workout yet doesn’t break the streak; a missed week does', () => {
    expect(workoutStats([w('2026-10-05'), w('2026-10-12')], '2026-10-21').streakWeeks).toBe(2)
    expect(workoutStats([w('2026-09-28'), w('2026-10-12')], '2026-10-21').streakWeeks).toBe(1)
    expect(workoutStats([w('2026-09-28')], '2026-10-21').streakWeeks).toBe(0)
  })
})

describe('body', () => {
  const m = (date: string, weight_lb: number, waist_in?: number): Measurement => ({ id: date, member_id: 'm', date, weight_lb, waist_in })
  it('weight: 7-day trend, baseline → current, goal progress', () => {
    const pts = series([m('2026-10-01', 212), m('2026-10-03', 210), m('2026-10-05', 211), m('2026-10-15', 205), m('2026-10-17', 204)], 'weight_lb')
    expect(pts[2].trend).toBeCloseTo(211, 5) // 212, 210, 211
    expect(pts[4].trend).toBeCloseTo(204.5, 5) // only the last 7 days
    const c = bodyChange(pts)!
    expect(c.baseline.value).toBe(212)
    expect(c.change).toBeCloseTo(-7.5, 5)
    expect(goalProgress(212, 204.5, 185)).toBeCloseTo(27.8, 1)
    expect(goalProgress(212, 214, 185)).toBe(0)
  })

  it('waist uses the latest value, not a trend', () => {
    const c = bodyChange(series([m('2026-10-01', 212, 40), m('2026-10-20', 205, 38.5)], 'waist_in'), false)!
    expect(c.change).toBe(-1.5)
  })
})

describe('lifts', () => {
  const ws = [w('2026-09-01', 'bench_press', [[185, 8], [185, 7]]), w('2026-09-08', 'bench_press', [[195, 6]]), w('2026-10-20', 'bench_press', [[190, 10]]), w('2026-10-20', 'push_up', [[0, 20]]), w('2026-09-01', 'push_up', [[0, 12]])]
  it('adults: baseline vs best estimated max', () => {
    const bench = liftProgress(ws, false).find((l) => l.exercise_id === 'bench_press')!
    expect(bench).toMatchObject({ measure: 'e1rm', sessions: 3, baseline: { value: 234, label: '185 lb × 8' }, best: { value: 253, label: '190 lb × 10' } })
    expect(bench.pct).toBeCloseTo(8.1, 1)
    expect(liftProgress(ws, false)[0].exercise_id).toBe('bench_press') // main lifts first
  })

  it('kids: heaviest weight and most reps, never an estimated max', () => {
    const l = liftProgress(ws, true)
    expect(l.find((x) => x.exercise_id === 'bench_press')).toMatchObject({ measure: 'weight', baseline: { value: 185 }, best: { value: 195 } })
    expect(l.find((x) => x.exercise_id === 'push_up')).toMatchObject({ measure: 'reps', baseline: { value: 12 }, best: { value: 20 }, change: 8 })
  })
})

describe('tests', () => {
  const t = (date: string, test: TestRecord['test'], value: number) => ({ id: date + test, member_id: 'k', test, date, value, capture_fps: 240, file_fps: 240, marks: {}, thumbnail: null, findings: [], drills: [] }) as TestRecord
  it('baseline, best and improvement in the right direction', () => {
    const p = testProgress([t('2026-09-01', 'sprint10', 2.1), t('2026-10-01', 'sprint10', 1.95), t('2026-10-15', 'sprint10', 2.0), t('2026-09-01', 'vertical', 14), t('2026-10-01', 'vertical', 15.5)])
    expect(p.find((x) => x.test === 'sprint10')).toMatchObject({ count: 3, best: { value: 1.95 }, latest: { value: 2.0 } })
    expect(p.find((x) => x.test === 'sprint10')!.improvement).toBeCloseTo(0.15, 5)
    expect(p.find((x) => x.test === 'vertical')!.improvement).toBeCloseTo(1.5, 5)
  })
})
