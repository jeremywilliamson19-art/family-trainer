// Training: programs and workout logs (spec section 8). The youth
// guardrails that matter for safety are enforced here too, not only in the
// app: only a parent edits the son's program, his prescribed effort is
// capped at RPE 8, and only a parent can mark his form "good".
import type { ChildGuardianSettings, LoggedExercise, Measurement, MemberPrivate, Program, ProgramDay, TestRecord, Workout } from '../../src/lib/types'
import { ApiError, canManage, iso, num, text, type Env, type MemberRow, type Params } from './api'

const ID_RE = /^[\w:.-]{1,80}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const YOUTH_MAX_RPE = 8

function id(v: unknown, label: string): string {
  const s = String(v ?? '')
  if (!ID_RE.test(s)) throw new ApiError('invalid', `Bad ${label}`)
  return s
}
function location(v: unknown): 'gym' | 'home' {
  if (v !== 'gym' && v !== 'home') throw new ApiError('invalid', 'Pick gym or home')
  return v
}
function optNum(v: unknown, lo: number, hi: number, label: string): number | null {
  return v === null || v === undefined || v === '' ? null : num(v, lo, hi, label)
}

function cleanDays(raw: unknown, youth: boolean): ProgramDay[] {
  if (!Array.isArray(raw) || !raw.length || raw.length > 7) throw new ApiError('invalid', 'A program needs 1–7 days')
  return raw.map((d) => {
    const day = d as Record<string, unknown>
    const list = Array.isArray(day.exercises) ? day.exercises : []
    if (list.length > 20) throw new ApiError('invalid', 'Too many exercises in one day')
    return {
      name: text(day.name, 40, 'day name'),
      exercises: list.map((e) => {
        const x = e as Record<string, unknown>
        const repMin = num(x.rep_min, 1, 120, 'reps')
        const rpe = optNum(x.rpe, 1, 10, 'effort')
        return {
          exercise_id: id(x.exercise_id, 'exercise'),
          sets: num(x.sets, 1, 10, 'sets'),
          rep_min: repMin,
          rep_max: Math.max(repMin, num(x.rep_max, 1, 120, 'reps')),
          ...(rpe !== null || youth ? { rpe: youth ? Math.min(rpe ?? YOUTH_MAX_RPE, YOUTH_MAX_RPE) : rpe! } : {}),
          rest_s: num(x.rest_s ?? 90, 0, 600, 'rest'),
          ...(x.optional ? { optional: true } : {}),
        }
      }),
    }
  })
}

function saveProgram(env: Env, me: MemberRow, p: Params) {
  const raw = (p.program ?? {}) as Record<string, unknown>
  const target = canManage(env, me, String(raw.member_id ?? me.id))
  if (me.role === 'child') throw new ApiError('forbidden', 'Ask a parent to change your program')
  const pid = id(raw.id, 'program')
  const existing = env.store.get<Program>('programs', pid)
  if (existing && existing.member_id !== target.id) throw new ApiError('forbidden', 'Not allowed')
  const youth = target.role === 'child'
  env.store.put<Program>('programs', pid, {
    id: pid,
    member_id: target.id,
    template: String(raw.template ?? 'custom').slice(0, 40),
    name: text(raw.name, 60, 'program name'),
    location: location(raw.location),
    youth,
    days: cleanDays(raw.days, youth),
    updated_at: iso(env),
  })
  return { ok: true }
}

function deleteProgram(env: Env, me: MemberRow, p: Params) {
  const prog = env.store.get<Program>('programs', String(p.id ?? ''))
  if (!prog) return { ok: true }
  canManage(env, me, prog.member_id)
  if (me.role === 'child') throw new ApiError('forbidden', 'Ask a parent to change your program')
  env.store.del('programs', prog.id)
  return { ok: true }
}

function cleanExercises(raw: unknown): LoggedExercise[] {
  if (!Array.isArray(raw) || raw.length > 30) throw new ApiError('invalid', 'Bad workout')
  return raw.map((e) => {
    const x = e as Record<string, unknown>
    const sets = Array.isArray(x.sets) ? x.sets : []
    if (sets.length > 20) throw new ApiError('invalid', 'Too many sets')
    const repMin = num(x.rep_min ?? 1, 1, 120, 'reps')
    return {
      exercise_id: id(x.exercise_id, 'exercise'),
      rep_min: repMin,
      rep_max: Math.max(repMin, num(x.rep_max ?? repMin, 1, 120, 'reps')),
      sets: sets.map((s) => {
        const y = s as Record<string, unknown>
        return {
          weight: optNum(y.weight, 0, 2000, 'weight'),
          reps: optNum(y.reps, 0, 1000, 'reps'),
          rpe: optNum(y.rpe, 1, 10, 'effort'),
          done: y.done === true,
        }
      }),
      ...(x.form_good === true || x.form_good === false ? { form_good: x.form_good } : {}),
    }
  })
}

function saveWorkout(env: Env, me: MemberRow, p: Params) {
  const raw = (p.workout ?? {}) as Record<string, unknown>
  const wid = id(raw.id, 'workout')
  const target = canManage(env, me, String(raw.member_id ?? me.id))
  const existing = env.store.get<Workout>('workouts', wid)
  if (existing && existing.member_id !== target.id) throw new ApiError('forbidden', 'Not allowed')
  const date = String(raw.date ?? '')
  if (!DATE_RE.test(date)) throw new ApiError('invalid', 'Bad date')
  let exercises = cleanExercises(raw.exercises)
  // Form checks belong to the parent: a child's own save keeps whatever is stored.
  if (me.role === 'child') {
    exercises = exercises.map((e, i) => {
      const { form_good: _f, ...rest } = e
      const prev = existing?.exercises[i]
      return prev && prev.exercise_id === e.exercise_id && prev.form_good !== undefined ? { ...rest, form_good: prev.form_good } : rest
    })
  }
  env.store.put<Workout>('workouts', wid, {
    id: wid,
    member_id: target.id,
    date,
    name: text(raw.name ?? 'Workout', 60, 'workout name'),
    location: location(raw.location),
    program_id: raw.program_id ? id(raw.program_id, 'program') : null,
    day_index: raw.day_index === null || raw.day_index === undefined ? null : num(raw.day_index, 0, 6, 'day'),
    started_at: existing?.started_at ?? (typeof raw.started_at === 'string' ? raw.started_at : iso(env)),
    finished_at: typeof raw.finished_at === 'string' ? raw.finished_at : null,
    exercises,
    ...(raw.notes ? { notes: String(raw.notes).slice(0, 500) } : {}),
  })
  return { ok: true }
}

function deleteWorkout(env: Env, me: MemberRow, p: Params) {
  const w = env.store.get<Workout>('workouts', String(p.id ?? ''))
  if (!w) return { ok: true }
  canManage(env, me, w.member_id)
  env.store.del('workouts', w.id)
  return { ok: true }
}

/** Parent marks the son's form on one exercise of a session. */
function setFormGood(env: Env, me: MemberRow, p: Params) {
  const w = env.store.get<Workout>('workouts', String(p.workout_id ?? ''))
  if (!w) throw new ApiError('not_found', 'Workout not found')
  const target = canManage(env, me, w.member_id)
  if (target.role !== 'child' || me.id === target.id) throw new ApiError('forbidden', 'Only a parent marks form')
  const i = num(p.exercise_index, 0, w.exercises.length - 1, 'exercise')
  w.exercises[i] = { ...w.exercises[i], form_good: p.good === true }
  env.store.put('workouts', w.id, w)
  return { ok: true }
}

function listWorkouts(env: Env, me: MemberRow, p: Params) {
  const target = canManage(env, me, String(p.member_id ?? me.id))
  const from = DATE_RE.test(String(p.from)) ? String(p.from) : '0000-00-00'
  return env.store
    .all<Workout>('workouts')
    .filter((w) => w.member_id === target.id && w.date >= from)
    .sort((a, b) => a.date.localeCompare(b.date))
}

const TEST_IDS = ['vertical', 'broad', 'sprint10', 'dash40', 'pro_agility', 'three_cone'] as const
// Sheets cells hold 50,000 characters; keep the whole row well under that.
const MAX_THUMB = 20_000

function saveTest(env: Env, me: MemberRow, p: Params) {
  const raw = (p.record ?? {}) as Record<string, unknown>
  const tid = id(raw.id, 'test')
  const target = canManage(env, me, String(raw.member_id ?? me.id))
  const existing = env.store.get<TestRecord>('tests', tid)
  if (existing && existing.member_id !== target.id) throw new ApiError('forbidden', 'Not allowed')
  if (!TEST_IDS.includes(raw.test as never)) throw new ApiError('invalid', 'Unknown test')
  const date = String(raw.date ?? '')
  if (!DATE_RE.test(date)) throw new ApiError('invalid', 'Bad date')
  const isTime = raw.test !== 'vertical' && raw.test !== 'broad'
  const marks: Record<string, number> = {}
  for (const [k, v] of Object.entries((raw.marks ?? {}) as Record<string, unknown>).slice(0, 6)) {
    if (/^\w{1,20}$/.test(k)) marks[k] = num(v, 0, 10_000_000, 'frame')
  }
  const thumb = typeof raw.thumbnail === 'string' && raw.thumbnail.startsWith('data:image/jpeg;base64,') && raw.thumbnail.length <= MAX_THUMB ? raw.thumbnail : null
  const findings = (Array.isArray(raw.findings) ? raw.findings : []).slice(0, 12).map((f) => {
    const x = f as Record<string, unknown>
    const kind = x.kind === 'good' || x.kind === 'note' ? x.kind : 'focus'
    return { id: String(x.id ?? '').slice(0, 40), kind, title: String(x.title ?? '').slice(0, 100), detail: String(x.detail ?? '').slice(0, 400) } as TestRecord['findings'][number]
  })
  env.store.put<TestRecord>('tests', tid, {
    id: tid,
    member_id: target.id,
    test: raw.test as TestRecord['test'],
    date,
    value: isTime ? num(raw.value, 0.5, 60, 'time') : num(raw.value, 1, 200, 'distance'),
    split10: raw.split10 == null ? null : num(raw.split10, 0.3, 10, 'split'),
    mph: raw.mph == null ? null : num(raw.mph, 0, 40, 'speed'),
    split_mph: raw.split_mph == null ? null : num(raw.split_mph, 0, 40, 'speed'),
    capture_fps: raw.capture_fps == null ? null : num(raw.capture_fps, 1, 1000, 'frame rate'),
    file_fps: raw.file_fps == null ? null : num(raw.file_fps, 1, 1000, 'frame rate'),
    marks,
    thumbnail: thumb,
    findings,
    drills: (Array.isArray(raw.drills) ? raw.drills : []).slice(0, 12).map((d) => id(d, 'drill')),
    ...(raw.notes ? { notes: String(raw.notes).slice(0, 300) } : {}),
  })
  return { ok: true }
}

function deleteTest(env: Env, me: MemberRow, p: Params) {
  const t = env.store.get<TestRecord>('tests', String(p.id ?? ''))
  if (!t) return { ok: true }
  canManage(env, me, t.member_id)
  env.store.del('tests', t.id)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Body measurements. A parent logs the son's (he can see them, not edit them).
// ---------------------------------------------------------------------------

function saveMeasurement(env: Env, me: MemberRow, p: Params) {
  const raw = (p.measurement ?? {}) as Record<string, unknown>
  const mid = id(raw.id, 'entry')
  const target = canManage(env, me, String(raw.member_id ?? me.id))
  if (me.role === 'child') throw new ApiError('forbidden', 'A parent logs your measurements')
  const existing = env.store.get<Measurement>('measurements', mid)
  if (existing && existing.member_id !== target.id) throw new ApiError('forbidden', 'Not allowed')
  const date = String(raw.date ?? '')
  if (!DATE_RE.test(date)) throw new ApiError('invalid', 'Bad date')
  const opt = (v: unknown, lo: number, hi: number, label: string) => (v === null || v === undefined || v === '' ? null : num(v, lo, hi, label))
  const m: Measurement = {
    id: mid,
    member_id: target.id,
    date,
    weight_lb: opt(raw.weight_lb, 30, 700, 'weight'),
    waist_in: opt(raw.waist_in, 15, 80, 'waist'),
    chest_in: opt(raw.chest_in, 15, 80, 'chest'),
    height_in: opt(raw.height_in, 30, 96, 'height'),
  }
  if (m.weight_lb === null && m.waist_in === null && m.chest_in === null && m.height_in === null) throw new ApiError('invalid', 'Enter at least one number')
  env.store.put('measurements', mid, m)

  // The newest weigh-in (and height) becomes the current profile value, which
  // the calorie/protein targets are calculated from.
  const mine = env.store.all<Measurement>('measurements').filter((x) => x.member_id === target.id)
  const latest = (k: 'weight_lb' | 'height_in') => mine.filter((x) => typeof x[k] === 'number').sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.[k] ?? null
  const priv = env.store.get<MemberPrivate>('member_private', target.id)
  if (priv) {
    const w = latest('weight_lb')
    const h = latest('height_in')
    env.store.put<MemberPrivate>('member_private', target.id, { ...priv, ...(w !== null ? { weight_lb: w } : {}), ...(h !== null ? { height_in: h } : {}) })
  }
  return { ok: true }
}

function deleteMeasurement(env: Env, me: MemberRow, p: Params) {
  const m = env.store.get<Measurement>('measurements', String(p.id ?? ''))
  if (!m) return { ok: true }
  canManage(env, me, m.member_id)
  if (me.role === 'child') throw new ApiError('forbidden', 'A parent logs your measurements')
  env.store.del('measurements', m.id)
  return { ok: true }
}

function measurementsFor(env: Env, memberId: string): Measurement[] {
  return env.store.all<Measurement>('measurements').filter((m) => m.member_id === memberId)
}

/** The son's limits, set by the parent (in-season, foot-contact cap). */
function youthLimits(env: Env, member: MemberRow) {
  if (member.role !== 'child') return null
  const g = env.store.get<ChildGuardianSettings>('child_guardian_settings', member.id)
  return { in_season: member.in_season, foot_contact_cap: g?.foot_contact_cap ?? 80 }
}

/** Everything the Train tab needs in one round trip. */
function trainingSync(env: Env, me: MemberRow, p: Params) {
  const target = canManage(env, me, String(p.member_id ?? me.id))
  return {
    programs: env.store.all<Program>('programs').filter((x) => x.member_id === target.id),
    workouts: listWorkouts(env, me, { member_id: target.id, from: p.from }),
    tests: env.store.all<TestRecord>('tests').filter((t) => t.member_id === target.id),
    measurements: measurementsFor(env, target.id),
    limits: youthLimits(env, target),
  }
}

export const TRAINING_AUTHED: Record<string, (env: Env, me: MemberRow, p: Params) => unknown> = {
  saveProgram,
  deleteProgram,
  saveWorkout,
  deleteWorkout,
  setFormGood,
  saveTest,
  deleteTest,
  saveMeasurement,
  deleteMeasurement,
  listWorkouts,
  trainingSync,
}
