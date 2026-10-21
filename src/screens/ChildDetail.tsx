import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ScheduleEditor } from '../components/ScheduleEditor'
import { SportPicker } from '../components/SportPicker'
import { Toggle } from '../components/Toggle'
import { api } from '../lib/api'
import { exercise } from '../lib/exercises'
import { addDays, dayTotals, localDate } from '../lib/nutrition'
import { YOUTH } from '../lib/programs'
import { makeProgram } from './training/TrainHome'
import type { ChildGuardianSettings, ChildTargets, Meal, Member, MemberPrivate, MemberSettings, Program, Workout } from '../lib/types'
import { useRow } from '../lib/useRow'

function PairingCode({ childId }: { childId: string }) {
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null)
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [code])

  const generate = async () => {
    setError(null)
    try {
      setCode(await api<{ code: string; expires_at: string }>('createPairingCode', { child_id: childId }))
      setNow(Date.now())
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const left = code ? Math.max(0, Math.floor((new Date(code.expires_at).getTime() - now) / 1000)) : 0
  return (
    <div className="stack">
      {code && left > 0 ? (
        <>
          <p className="pairing-code">
            {code.code.slice(0, 4)} {code.code.slice(4)}
          </p>
          <p className="muted center-text">
            Type this into his phone. Expires in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}.
          </p>
        </>
      ) : (
        code && <p className="muted">That code expired.</p>
      )}
      <button className="btn" onClick={generate}>
        {code ? 'New pairing code' : 'Generate pairing code'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}

/** The child's member record, from the household list. */
function useChild(id: string) {
  const [row, setRow] = useState<Member | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api<Member[]>('listMembers').then(
      (all) => setRow(all.find((m) => m.id === id) ?? null),
      (e) => setError((e as Error).message),
    )
  }, [id])
  const save = async (patch: Partial<Member>) => {
    const before = row
    setRow((r) => (r ? { ...r, ...patch } : r))
    try {
      setRow(await api<Member>('updateMember', { member_id: id, patch }))
    } catch (e) {
      setRow(before)
      setError((e as Error).message)
    }
  }
  return { row, save, error }
}

/** The son's program and recent sessions, with the form check that unlocks more weight. */
function ChildTraining({ childId }: { childId: string }) {
  const [data, setData] = useState<{ programs: Program[]; workouts: Workout[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    api<{ programs: Program[]; workouts: Workout[] }>('trainingSync', { member_id: childId, from: addDays(localDate(), -30) }).then(setData, (e) =>
      setError((e as Error).message),
    )
  }, [childId])
  useEffect(load, [load])

  const setUp = async () => {
    await api('saveProgram', { program: makeProgram(YOUTH, childId) }).catch((e) => setError((e as Error).message))
    load()
  }
  const markForm = async (w: Workout, i: number, good: boolean) => {
    setData((d) => d && { ...d, workouts: d.workouts.map((x) => (x.id === w.id ? { ...x, exercises: x.exercises.map((e, j) => (j === i ? { ...e, form_good: good } : e)) } : x)) })
    await api('setFormGood', { workout_id: w.id, exercise_index: i, good }).catch((e) => setError((e as Error).message))
  }

  if (!data) return error ? <p className="error">{error}</p> : null
  const program = data.programs[0]
  const recent = [...data.workouts].filter((w) => w.finished_at).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  return (
    <section className="card stack">
      <h2>Training</h2>
      {program ? (
        <div className="row">
          <span>
            {program.name}
            <small className="muted block">{program.days.length} days · only you can edit it</small>
          </span>
          <Link to={`/train/program/${program.id}?member=${childId}`} className="btn small secondary">
            Edit
          </Link>
        </div>
      ) : (
        <>
          <p className="muted small">3-day youth plan: landing drills, jumps, sprint mechanics and technique-first strength.</p>
          <button className="btn" onClick={setUp}>
            Set up his program
          </button>
        </>
      )}
      <Link to={`/tests?who=${childId}`} className="btn secondary">
        ⚡ Speed &amp; jump tests
      </Link>
      {recent.length > 0 && (
        <>
          <h3>Check his form</h3>
          <p className="muted small">When his form looked good, tap it. Weight only goes up after you do.</p>
          {recent.map((w) => (
            <div key={w.id} className="form-check">
              <strong className="small">
                {w.name} · {new Date(`${w.date}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </strong>
              {w.exercises.map((e, i) =>
                exercise(e.exercise_id).kind === 'strength' ? (
                  <label key={i} className="row toggle">
                    <span className="small">
                      {exercise(e.exercise_id).name}
                      <small className="muted block">
                        {e.sets.filter((s) => s.done).map((s) => `${s.weight ? `${s.weight}×` : ''}${s.reps}`).join(', ')}
                      </small>
                    </span>
                    <input type="checkbox" role="switch" checked={!!e.form_good} onChange={(ev) => markForm(w, i, ev.target.checked)} />
                  </label>
                ) : null,
              )}
            </div>
          ))}
        </>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  )
}

/** The parent's view of the son's protein today. */
function ChildProteinToday({ childId }: { childId: string }) {
  const [data, setData] = useState<{ eaten: number; target: number | null } | null>(null)
  useEffect(() => {
    const today = localDate()
    Promise.all([api<Meal[]>('listMeals', { member_id: childId, from: today, to: today }), api<ChildTargets | null>('getTargets', { member_id: childId })]).then(
      ([meals, t]) => setData({ eaten: dayTotals(meals).protein, target: t?.protein_g ?? null }),
      () => {},
    )
  }, [childId])
  if (!data) return null
  return (
    <section className="card">
      <h2>Protein today</h2>
      <p>
        <strong>{Math.round(data.eaten)}</strong>
        {data.target !== null && <span className="muted"> / {data.target} g</span>}
      </p>
    </section>
  )
}

/** Number input that saves on blur. */
function NumberField({ label, value, step = 1, onSave }: { label: string; value: number | null; step?: number; onSave: (n: number) => void }) {
  const [v, setV] = useState(value?.toString() ?? '')
  useEffect(() => setV(value?.toString() ?? ''), [value])
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== '' && Number(v) !== value && onSave(Number(v))}
      />
    </label>
  )
}

export function ChildDetail() {
  const { id } = useParams()
  const kid = useChild(id!)
  const body = useRow<MemberPrivate>('getPrivate', 'savePrivate', { member_id: id })
  const settings = useRow<MemberSettings>('getSettings', 'saveSettings', { member_id: id })
  const guard = useRow<ChildGuardianSettings>('getGuardian', 'saveGuardian', { child_id: id })
  const error = kid.error ?? body.error ?? settings.error ?? guard.error

  if (!kid.row) return <div className="screen">{error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}</div>
  const k = kid.row

  return (
    <div className="screen">
      <Link to="/admin" className="back">
        ‹ Family
      </Link>
      <h1>{k.display_name}</h1>
      {error && <p className="error">{error}</p>}

      <ChildProteinToday childId={k.id} />
      <ChildTraining childId={k.id} />

      <section className="card">
        <h2>Sign in his phone</h2>
        <PairingCode childId={k.id} />
      </section>

      <section className="card stack">
        <h2>Sports &amp; season</h2>
        <SportPicker value={k.sports} onChange={(v) => kid.save({ sports: v })} />
        <Toggle
          label="In season"
          hint="Cuts training volume ~40% and limits lifting to 2 days a week"
          checked={k.in_season}
          onChange={(v) => kid.save({ in_season: v })}
        />
      </section>

      {settings.row && (
        <section className="card stack">
          <h2>Training days</h2>
          <ScheduleEditor value={settings.row.weekly_schedule} onChange={(v) => settings.save({ weekly_schedule: v })} />
        </section>
      )}

      {body.row && (
        <section className="card stack">
          <h2>Body (parent only)</h2>
          <p className="muted small">He never sees these numbers.</p>
          <NumberField label="Age" value={body.row.age_years} onSave={(n) => body.save({ age_years: n })} />
          <NumberField label="Height (in)" value={body.row.height_in} step={0.25} onSave={(n) => body.save({ height_in: n })} />
          <NumberField label="Weight (lb)" value={body.row.weight_lb} step={0.1} onSave={(n) => body.save({ weight_lb: n })} />
        </section>
      )}

      {guard.row && (
        <section className="card stack">
          <h2>Coaching limits</h2>
          <NumberField
            label="Protein (g per lb of body weight)"
            value={guard.row.protein_g_per_lb}
            step={0.05}
            onSave={(n) => guard.save({ protein_g_per_lb: n })}
          />
          {body.row?.weight_lb && (
            <p className="muted small">
              He’ll see a daily target of {Math.round(body.row.weight_lb * guard.row.protein_g_per_lb)} g protein. Check with
              his pediatrician if unsure.
            </p>
          )}
          <NumberField label="Max foot contacts per session" value={guard.row.foot_contact_cap} onSave={(n) => guard.save({ foot_contact_cap: n })} />
          <NumberField
            label="Agility test reminder (weeks)"
            value={guard.row.test_reminder_weeks}
            onSave={(n) => guard.save({ test_reminder_weeks: n })}
          />
        </section>
      )}
    </div>
  )
}
