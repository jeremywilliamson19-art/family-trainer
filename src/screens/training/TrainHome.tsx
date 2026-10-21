import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { exercise, MUSCLES } from '../../lib/exercises'
import { localDate } from '../../lib/nutrition'
import { DUMBBELL_HOME, UPPER_LOWER, type Template } from '../../lib/programs'
import { useMember } from '../../lib/session'
import { newId } from '../../lib/syncStore'
import { armWarnings, footContacts, nextDayIndex, plateau, weekStart, weeklyVolume } from '../../lib/training'
import { mutateTraining, setDraft, useDraft, useTraining } from '../../lib/trainingStore'
import type { Program } from '../../lib/types'
import { useSettings } from '../../lib/useSettings'
import { newWorkout, planDay, prescription, programFor, todayType } from './plan'

export function TrainHome() {
  const member = useMember()
  const youth = member.role === 'child'
  const settings = useSettings()
  const { programs, workouts, limits, loaded, syncing, error } = useTraining()
  const draft = useDraft()
  const nav = useNavigate()
  const today = localDate()
  const type = todayType(settings)
  const location = type === 'rest' ? (programs[0]?.location ?? 'gym') : type
  const program = programFor(programs, location)
  const [pickDay, setPickDay] = useState<number | null>(null)

  const dayIndex = program ? (pickDay ?? nextDayIndex(program, workouts)) : null
  const plan = program && dayIndex !== null ? planDay(program, program.days[dayIndex], workouts, limits) : null
  const vol = useMemo(() => weeklyVolume(workouts, weekStart(today)), [workouts, today])
  const plateaus = useMemo(() => {
    if (youth) return []
    const mains = new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exercise_id)).filter((id) => exercise(id).main))
    return [...mains].map((id) => plateau(id, workouts, today)).filter((x): x is string => !!x)
  }, [workouts, today, youth])
  const conditioningThisWeek = workouts.filter(
    (w) => w.date >= weekStart(today) && w.exercises.some((e) => exercise(e.exercise_id).kind === 'conditioning' && e.sets.some((s) => s.done)),
  ).length
  const recent = [...workouts].filter((w) => w.finished_at).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)

  const start = () => {
    setDraft(
      newWorkout({
        memberId: member.id,
        name: program && dayIndex !== null ? program.days[dayIndex].name : 'Workout',
        location,
        program,
        dayIndex,
        plan,
        workouts,
        youth,
      }),
    )
    nav('/train/workout')
  }

  if (draft && draft.member_id === member.id) {
    return (
      <div className="screen">
        <h1>Train</h1>
        <section className="card stack">
          <h2>Workout in progress</h2>
          <p className="muted">
            {draft.name} · started {new Date(draft.started_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </p>
          <Link to="/train/workout" className="btn">
            Continue
          </Link>
        </section>
      </div>
    )
  }

  if (!loaded && !programs.length) {
    return (
      <div className="screen">
        <h1>Train</h1>
        <p className="muted">{syncing ? 'Loading…' : (error ?? 'Connect to the internet to load your program.')}</p>
      </div>
    )
  }

  if (!programs.length) {
    return youth ? (
      <div className="screen">
        <h1>Train</h1>
        <section className="card">
          <p className="muted">Your program shows up here once a parent sets it up.</p>
        </section>
      </div>
    ) : (
      <ChooseProgram memberId={member.id} />
    )
  }

  return (
    <div className="screen">
      <h1>Train</h1>

      <section className="card stack">
        <div className="row">
          <h2>{type === 'rest' ? 'Rest day' : `Today · ${type === 'gym' ? 'Gym' : 'Home'}`}</h2>
          {program && program.days.length > 1 && (
            <select aria-label="Choose a day" value={dayIndex ?? 0} onChange={(e) => setPickDay(Number(e.target.value))} className="day-select">
              {program.days.map((d, i) => (
                <option key={i} value={i}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {type === 'rest' && <p className="muted small">Recovery is part of the plan. You can still train if you want.</p>}
        {program && plan && dayIndex !== null && (
          <>
            <strong>{program.days[dayIndex].name}</strong>
            <ul className="plan-list">
              {plan.exercises.map((pe, i) => (
                <li key={i} className={pe.optional ? 'muted' : ''}>
                  <span>
                    {exercise(pe.exercise_id).name}
                    {pe.optional && ' (optional)'}
                  </span>
                  <small className="muted">{prescription(pe.sets, pe.rep_min, pe.rep_max, pe.exercise_id)}</small>
                </li>
              ))}
            </ul>
            {youth && limits && (
              <p className="muted small">
                Foot contacts today: {footContacts(plan.exercises)} of {limits.foot_contact_cap}. Effort stays at 8/10 or easier.
              </p>
            )}
            {plan.notes.map((n) => (
              <p key={n} className="muted small">
                {n}
              </p>
            ))}
          </>
        )}
        <button className="btn" onClick={start}>
          Start workout
        </button>
        <button
          className="btn link"
          onClick={() => {
            setDraft(newWorkout({ memberId: member.id, name: 'Workout', location, program: null, dayIndex: null, plan: null, workouts, youth }))
            nav('/train/workout')
          }}
        >
          Start an empty workout
        </button>
      </section>

      <Link to="/progress" className="card row link-row tests-link">
        <span>
          <strong>📈 Progress</strong>
          <small className="muted block">Workouts logged, lifts and body vs your baseline</small>
        </span>
        <span className="muted">›</span>
      </Link>

      <Link to="/tests" className="card row link-row tests-link">
        <span>
          <strong>⚡ Speed &amp; jump tests</strong>
          <small className="muted block">Film a sprint or jump; get the time, speed, height and a form check with drills</small>
        </span>
        <span className="muted">›</span>
      </Link>

      {!youth && (
        <section className="card stack">
          <h2>This week</h2>
          <div className="volume-grid">
            {MUSCLES.filter((m) => m.id !== 'forearms').map((m) => {
              const v = Math.floor(vol[m.id] ?? 0)
              const arm = m.id === 'biceps' || m.id === 'triceps'
              return (
                <div key={m.id} className={arm ? (v >= 12 ? 'ok-chip' : 'warn-chip') : ''}>
                  <strong>{v}</strong>
                  <span>{m.label}</span>
                </div>
              )
            })}
          </div>
          <small className="muted">Hard sets per muscle. Arms target: 12–20 each.</small>
          {armWarnings(vol).map((w) => (
            <p key={w} className="warn-text small">
              ⚠️ {w}
            </p>
          ))}
          <p className="muted small">
            Conditioning sessions: {conditioningThisWeek} of 2–3 (optional). Fat loss comes from the overall calorie deficit; it can’t be
            spot-reduced.
          </p>
          {plateaus.map((p) => (
            <p key={p} className="card warn small">
              {p}
            </p>
          ))}
        </section>
      )}

      <section className="card">
        <h2>Recent workouts</h2>
        {recent.length ? (
          <ul className="list">
            {recent.map((w) => (
              <li key={w.id}>
                <Link to={`/train/log/${w.id}`} className="row link-row">
                  <span>
                    {w.name}
                    <small className="muted block">
                      {new Date(`${w.date}T12:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
                      {(() => {
                        const n = w.exercises.reduce((c, e) => c + e.sets.filter((s) => s.done).length, 0)
                        return `${n} ${n === 1 ? 'set' : 'sets'}`
                      })()}
                    </small>
                  </span>
                  <span className="muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Finished workouts show up here.</p>
        )}
      </section>

      <section className="card stack">
        <h2>{youth ? 'My program' : 'My programs'}</h2>
        {programs.map((p) => (
          <div key={p.id} className="row">
            <span>
              {p.name}
              <small className="muted block">
                {p.location === 'gym' ? 'Gym' : 'Home'} · {p.days.length} days
              </small>
            </span>
            {!youth && (
              <Link to={`/train/program/${p.id}`} className="btn small secondary">
                Edit
              </Link>
            )}
          </div>
        ))}
        {!youth && <Link to="/train/choose" className="btn link">Add or switch program</Link>}
      </section>
    </div>
  )
}

export function makeProgram(t: Template, memberId: string): Program {
  return { id: newId(), member_id: memberId, template: t.id, name: t.name, location: t.location, youth: t.youth, days: structuredClone(t.days), updated_at: new Date().toISOString() }
}

/** Pick a starter program (Dad can have one for the gym and one for home). */
export function ChooseProgram({ memberId }: { memberId: string }) {
  const nav = useNavigate()
  const { programs } = useTraining()
  const choose = (t: Template) => {
    if (programs.some((p: Program) => p.template === t.id) && !confirm('Replace your edited version with the original program?')) return
    // One program per location: picking a new gym program replaces the old one.
    for (const p of programs.filter((p: Program) => p.location === t.location)) mutateTraining({ type: 'deleteProgram', id: p.id })
    mutateTraining({ type: 'saveProgram', program: makeProgram(t, memberId) })
    nav('/train', { replace: true })
  }
  return (
    <div className="screen">
      <h1>Choose a program</h1>
      <p className="muted">You can use one for gym days and one for home days. Both are fully editable.</p>
      {[UPPER_LOWER, DUMBBELL_HOME].map((t) => {
        const current = programs.find((p: Program) => p.template === t.id)
        return (
          <section key={t.id} className="card stack">
            <h2>{t.name}</h2>
            <p className="muted small">{t.blurb}</p>
            <ul className="plan-list">
              {t.days.map((d) => (
                <li key={d.name}>
                  <span>{d.name}</span>
                  <small className="muted">{d.exercises.filter((e) => !e.optional).length} exercises</small>
                </li>
              ))}
            </ul>
            <button className={current ? 'btn secondary' : 'btn'} onClick={() => choose(t)}>
              {current ? 'Reset to the original' : `Use for ${t.location === 'gym' ? 'gym' : 'home'} days`}
            </button>
          </section>
        )
      })}
    </div>
  )
}
