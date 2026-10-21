import { describe, expect, it } from 'vitest'
import { exercise } from './exercises'
import { DUMBBELL_HOME, TEMPLATES, UPPER_LOWER, YOUTH } from './programs'
import { advise, armWarnings, carryForward, e1rm, findPRs, footContacts, nextDayIndex, plateau, weekStart, weeklyVolume, youthDayPlan } from './training'
import type { LoggedExercise, LoggedSet, Program, ProgramDay, Workout } from './types'

let n = 0
/** A finished workout with one exercise; sets as [weight, reps, rpe?]. */
function session(date: string, exercise_id: string, sets: [number, number, number?][], extra: Partial<LoggedExercise> = {}, range: [number, number] = [8, 12]): Workout {
  return {
    id: `w${++n}`,
    member_id: 'm',
    date,
    name: 'x',
    location: 'gym',
    program_id: 'p',
    day_index: 0,
    started_at: `${date}T10:00:00Z`,
    finished_at: `${date}T11:00:00Z`,
    exercises: [{ exercise_id, rep_min: range[0], rep_max: range[1], sets: sets.map(([weight, reps, rpe]) => ({ weight, reps, rpe: rpe ?? null, done: true })), ...extra }],
  }
}

/** Hard sets per week a template prescribes for a muscle (secondary = ½). */
function programVolume(days: ProgramDay[], muscle: string) {
  let v = 0
  for (const d of days)
    for (const e of d.exercises) {
      const ex = exercise(e.exercise_id)
      if (ex.primary.includes(muscle as never)) v += e.sets
    }
  return v
}

describe('starter programs', () => {
  it('every exercise exists in the library', () => {
    const missing = TEMPLATES.flatMap((t) => t.days.flatMap((d) => d.exercises.map((e) => e.exercise_id))).filter((id) => exercise(id).name === id)
    expect(missing).toEqual([])
  })

  it('Dad’s programs: 12–20 direct sets of each arm muscle a week, triceps ≥ biceps', () => {
    for (const t of [UPPER_LOWER, DUMBBELL_HOME]) {
      const tri = programVolume(t.days, 'triceps')
      const bi = programVolume(t.days, 'biceps')
      expect(tri).toBeGreaterThanOrEqual(12)
      expect(tri).toBeLessThanOrEqual(21) // dips count as triceps too
      expect(bi).toBeGreaterThanOrEqual(12)
      expect(bi).toBeLessThanOrEqual(20)
      expect(tri).toBeGreaterThanOrEqual(bi)
    }
  })

  it('arms are hit directly on at least 2 days a week', () => {
    for (const t of [UPPER_LOWER, DUMBBELL_HOME]) {
      const armDays = t.days.filter((d) => d.exercises.some((e) => exercise(e.exercise_id).primary.some((m) => m === 'biceps' || m === 'triceps')))
      expect(armDays.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('youth plan: only youth exercises, ≤ 80 contacts, landing drills first, no max-effort', () => {
    for (const d of YOUTH.days) {
      expect(d.exercises.every((e) => exercise(e.exercise_id).youth)).toBe(true)
      expect(footContacts(d.exercises)).toBeLessThanOrEqual(80)
      const firstLanding = d.exercises.findIndex((e) => exercise(e.exercise_id).kind === 'landing')
      const firstBig = d.exercises.findIndex((e) => exercise(e.exercise_id).highIntensity)
      expect(firstLanding).toBeGreaterThanOrEqual(0)
      expect(firstLanding).toBeLessThan(firstBig)
      expect(d.exercises.every((e) => e.rep_min >= 4)).toBe(true) // never singles
    }
  })
})

describe('logging sets', () => {
  const blank = (): LoggedSet[] => [0, 1, 2].map(() => ({ weight: null, reps: null, rpe: null, done: false }))
  it('135 × 11 on set 1 fills sets 2 and 3, typed digit by digit', () => {
    let sets = blank()
    for (const w of [1, 13, 135]) sets = carryForward(sets, 0, { weight: w })
    for (const r of [1, 11]) sets = carryForward(sets, 0, { reps: r })
    expect(sets.map((s) => [s.weight, s.reps])).toEqual([[135, 11], [135, 11], [135, 11]])
  })

  it('a later set changed by hand keeps its number; finished sets never change', () => {
    let sets = blank()
    sets = carryForward(sets, 0, { weight: 135, reps: 11 })
    sets = carryForward(sets, 2, { reps: 8 }) // set 3 only got 8
    sets[1] = { ...sets[1], done: true }
    sets = carryForward(sets, 0, { weight: 140 })
    expect(sets.map((s) => [s.weight, s.reps])).toEqual([[140, 11], [135, 11], [140, 8]])
  })
})

describe('double progression (adult)', () => {
  it('all sets at the top of the range at RPE ≤ 9 → add weight (+5 upper, +10 lower barbell)', () => {
    const a = advise('db_curl', [session('2026-10-01', 'db_curl', [[30, 12, 9], [30, 12, 9], [30, 12, 8]])], false)
    expect(a).toMatchObject({ kind: 'add_weight', weight: 35 })
    expect(advise('back_squat', [session('2026-10-01', 'back_squat', [[225, 10, 8], [225, 10, 9]], {}, [6, 10])], false).weight).toBe(235)
    expect(advise('bench_press', [session('2026-10-01', 'bench_press', [[185, 10, 8]], {}, [6, 10])], false).weight).toBe(190)
  })

  it('same reps two sessions in a row → hold', () => {
    const h = [session('2026-10-01', 'db_curl', [[30, 10], [30, 9]]), session('2026-10-04', 'db_curl', [[30, 10], [30, 9]])]
    expect(advise('db_curl', h, false).kind).toBe('hold')
  })

  it('reps dropping two sessions in a row → possible fatigue', () => {
    const h = [session('2026-10-01', 'db_curl', [[30, 11], [30, 11]]), session('2026-10-04', 'db_curl', [[30, 10], [30, 10]]), session('2026-10-07', 'db_curl', [[30, 9], [30, 8]])]
    expect(advise('db_curl', h, false).kind).toBe('fatigue')
  })

  it('a drop right after adding weight is not fatigue', () => {
    const h = [session('2026-10-01', 'db_curl', [[30, 12], [30, 12]]), session('2026-10-04', 'db_curl', [[35, 9], [35, 9]]), session('2026-10-07', 'db_curl', [[35, 8], [35, 8]])]
    expect(advise('db_curl', h, false).kind).not.toBe('fatigue')
  })
})

describe('youth progression', () => {
  const top = (form: boolean | null) => [session('2026-10-01', 'goblet_squat', [[20, 12, 7], [20, 12, 7]], { form_good: form })]

  it('reps first, then weight only after a parent marks form good', () => {
    expect(advise('goblet_squat', [session('2026-10-01', 'goblet_squat', [[20, 9, 7]])], true).kind).toBe('add_reps')
    expect(advise('goblet_squat', top(null), true).kind).toBe('form_check')
    expect(advise('goblet_squat', top(true), true)).toMatchObject({ kind: 'add_weight', weight: 22.5 })
  })

  it('in season: ~40% fewer sets, and no lifting after 2 lift days', () => {
    const day = YOUTH.days[0]
    const p = youthDayPlan(day, { inSeason: true, liftsThisWeek: 0, contactCap: 80 })
    const squat = p.exercises.find((e) => e.exercise_id === 'goblet_squat')!
    expect(squat.sets).toBe(2) // 3 × 0.6
    const p2 = youthDayPlan(day, { inSeason: true, liftsThisWeek: 2, contactCap: 80 })
    expect(p2.exercises.some((e) => exercise(e.exercise_id).kind === 'strength')).toBe(false)
    expect(p2.exercises.length).toBeGreaterThan(0)
  })

  it('trims jumps to the parent’s foot-contact cap and keeps landing drills first', () => {
    const p = youthDayPlan(YOUTH.days[0], { inSeason: false, liftsThisWeek: 0, contactCap: 25 })
    expect(footContacts(p.exercises)).toBeLessThanOrEqual(25)
    expect(exercise(p.exercises[0].exercise_id).kind).toBe('landing')
  })

  it('reorders landing drills ahead of big jumps if a parent edits them out of order', () => {
    const day: ProgramDay = { name: 'x', exercises: [{ exercise_id: 'box_jump', sets: 2, rep_min: 4, rep_max: 4, rest_s: 60 }, { exercise_id: 'snap_down', sets: 2, rep_min: 5, rep_max: 5, rest_s: 60 }] }
    expect(youthDayPlan(day, { inSeason: false, liftsThisWeek: 0, contactCap: 80 }).exercises[0].exercise_id).toBe('snap_down')
  })
})

describe('volume, PRs, plateaus', () => {
  it('counts completed sets per muscle per week; secondary muscles count half', () => {
    const w = session('2026-10-20', 'bench_press', [[185, 8], [185, 8], [135, 15]])
    const v = weeklyVolume([w], weekStart('2026-10-20'))
    expect(v).toMatchObject({ chest: 3, triceps: 1.5, shoulders: 1.5 })
    expect(armWarnings(v)).toEqual(['Triceps: 1 of 12 sets this week', 'Biceps: 0 of 12 sets this week'])
    expect(weekStart('2026-10-25')).toBe('2026-10-19') // Sunday → Monday before
  })

  it('PRs: adults by estimated max; kids by heaviest/most reps; first time isn’t a PR', () => {
    const a = session('2026-10-01', 'bench_press', [[185, 8]])
    const b = session('2026-10-08', 'bench_press', [[185, 10]])
    expect(findPRs(a, [a], false)).toEqual([])
    expect(findPRs(b, [a, b], false)[0].text).toMatch(/185 lb × 10.*est\. max 247/)
    expect(e1rm(185, 10)).toBeCloseTo(246.67, 1)
    const k1 = session('2026-10-01', 'push_up', [[0, 10]])
    const k2 = session('2026-10-08', 'push_up', [[0, 13]])
    expect(findPRs(k2, [k1, k2], true)[0].text).toMatch(/13 reps, most yet/)
    expect(findPRs(k2, [k1, k2], true)[0].text).not.toMatch(/max/)
  })

  it('plateau after 3+ flat weeks on a main lift, not before', () => {
    const flat = ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'].map((d) => session(d, 'bench_press', [[185, 8]]))
    expect(plateau('bench_press', flat, '2026-10-20')).toMatch(/flat for 3\+ weeks/)
    const rising = flat.map((w, i) => session(w.date, 'bench_press', [[185 + i * 5, 8]]))
    expect(plateau('bench_press', rising, '2026-10-20')).toBeNull()
    expect(plateau('db_curl', flat.map((w) => session(w.date, 'db_curl', [[30, 10]])), '2026-10-20')).toBeNull() // not a main lift
  })

  it('rotates through program days', () => {
    const prog = { id: 'p', days: UPPER_LOWER.days } as Program
    expect(nextDayIndex(prog, [])).toBe(0)
    expect(nextDayIndex(prog, [{ ...session('2026-10-01', 'bench_press', [[185, 8]]), day_index: 3 }])).toBe(0)
    expect(nextDayIndex(prog, [{ ...session('2026-10-01', 'bench_press', [[185, 8]]), day_index: 1 }])).toBe(2)
  })
})
