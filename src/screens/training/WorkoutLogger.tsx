import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ExercisePicker } from '../../components/training/ExercisePicker'
import { ExerciseLink } from '../../components/ExerciseLink'
import { FORM } from '../../lib/formGuide'
import { exercise } from '../../lib/exercises'
import { useMember } from '../../lib/session'
import { advise, carryForward, findPRs, footContacts, type Advice, type PR } from '../../lib/training'
import { mutateTraining, setDraft, useDraft, useTraining } from '../../lib/trainingStore'
import type { LoggedExercise, LoggedSet, Workout } from '../../lib/types'
import { useSettings } from '../../lib/useSettings'
import { prescription } from './plan'

const setsDone = (w: Workout) => w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)

const ADVICE_CLASS: Record<Advice['kind'], string> = {
  new: 'muted',
  add_weight: 'ok',
  add_reps: 'muted',
  hold: 'muted',
  fatigue: 'warn-text',
  form_check: 'warn-text',
}

/** Logging the workout in progress (the draft). */
export function WorkoutLogger() {
  const member = useMember()
  const youth = member.role === 'child'
  const settings = useSettings()
  const { workouts, limits } = useTraining()
  const draft = useDraft()
  const nav = useNavigate()
  const [adding, setAdding] = useState(false)
  const [summary, setSummary] = useState<{ prs: PR[]; sets: number } | null>(null)

  const advice = useMemo(() => {
    const m = new Map<string, Advice>()
    for (const e of draft?.exercises ?? []) if (!m.has(e.exercise_id)) m.set(e.exercise_id, advise(e.exercise_id, workouts, youth))
    return m
  }, [draft?.exercises, workouts, youth])

  if (summary) {
    return (
      <div className="screen">
        <h1>Nice work! 🎉</h1>
        <section className="card stack">
          <p>
            <strong>{summary.sets}</strong> {summary.sets === 1 ? 'set' : 'sets'} done.
          </p>
          {summary.prs.length ? (
            <>
              <h2>New bests</h2>
              <ul className="list">
                {summary.prs.map((p) => (
                  <li key={p.exercise_id} className="row">
                    🏆 {p.text}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted">Consistency is what builds results. See you next session.</p>
          )}
        </section>
        <button className="btn" onClick={() => nav('/train', { replace: true })}>
          Done
        </button>
      </div>
    )
  }

  if (!draft || draft.member_id !== member.id) return <Navigate to="/train" replace />
  const w = draft

  const update = (exercises: LoggedExercise[]) => setDraft({ ...w, exercises })
  const updateSet = (ei: number, si: number, patch: Partial<LoggedSet>) =>
    update(w.exercises.map((e, i) => (i === ei ? { ...e, sets: carryForward(e.sets, si, patch) } : e)))

  const toggleDone = (ei: number, si: number) => {
    const e = w.exercises[ei]
    const s = e.sets[si]
    const done = !s.done
    // Checking off a blank set means "same as the set before" (or the top of the range).
    const reps = s.reps ?? (done ? (e.sets[si - 1]?.reps ?? e.rep_max) : null)
    const weight = s.weight ?? (done ? (e.sets[si - 1]?.weight ?? null) : null)
    update(w.exercises.map((x, i) => (i === ei ? { ...x, sets: x.sets.map((y, j) => (j === si ? { ...y, done, reps, weight } : y)) } : x)))
  }

  const contacts = footContacts(w.exercises, true)
  const finish = () => {
    const done: Workout = { ...w, finished_at: new Date().toISOString(), exercises: w.exercises.filter((e) => e.sets.some((s) => s.done)) }
    if (!done.exercises.length) {
      if (confirm('Nothing was checked off. Discard this workout?')) {
        setDraft(null)
        nav('/train', { replace: true })
      }
      return
    }
    const prs = findPRs(done, [...workouts, done], youth)
    mutateTraining({ type: 'saveWorkout', workout: done })
    setDraft(null)
    setSummary({ prs, sets: done.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0) })
  }

  if (adding) {
    return (
      <ExercisePicker
        location={w.location}
        equipment={settings?.home_equipment ?? []}
        youthOnly={youth}
        onClose={() => setAdding(false)}
        onPick={(ex) => {
          const a = advise(ex.id, workouts, youth)
          const last = workouts.flatMap((x) => x.exercises).reverse().find((e) => e.exercise_id === ex.id)
          update([
            ...w.exercises,
            {
              exercise_id: ex.id,
              rep_min: last?.rep_min ?? 8,
              rep_max: last?.rep_max ?? 12,
              sets: Array.from({ length: 3 }, () => ({ weight: a.weight, reps: null, rpe: null, done: false })),
            },
          ])
          setAdding(false)
        }}
      />
    )
  }

  return (
    <div className="screen with-footer">
      <div className="row">
        <h1>{w.name}</h1>
        <button
          className="btn link small"
          onClick={() => {
            if (confirm('Discard this workout? Nothing will be saved.')) {
              setDraft(null)
              nav('/train', { replace: true })
            }
          }}
        >
          Discard
        </button>
      </div>

      {youth && limits && (
        <p className={contacts > limits.foot_contact_cap ? 'warn-text small' : 'muted small'}>
          Foot contacts: {contacts} of {limits.foot_contact_cap}
          {contacts > limits.foot_contact_cap && '. That’s the limit for today, so skip the remaining jumps.'}
        </p>
      )}

      {w.exercises.map((e, ei) => {
        const ex = exercise(e.exercise_id)
        const a = advice.get(e.exercise_id)
        const weighted = ex.load !== 'bodyweight'
        const unit = ex.unit === 'sec' ? 'sec' : ex.unit === 'yd' ? 'yd' : ex.unit === 'min' ? 'min' : 'reps'
        return (
          <section key={ei} className="card stack exercise-card">
            <div className="row">
              <span>
                <strong>
                  <ExerciseLink id={e.exercise_id} />
                </strong>
                <small className="muted block">{prescription(e.sets.length, e.rep_min, e.rep_max, e.exercise_id)}</small>
                {FORM[e.exercise_id] && <small className="form-cue block">Form: {FORM[e.exercise_id].cues[0]}</small>}
              </span>
              <button
                className="btn link small"
                aria-label={`Remove ${ex.name}`}
                onClick={() => update(w.exercises.filter((_, i) => i !== ei))}
              >
                ✕
              </button>
            </div>
            {a && <p className={`small ${ADVICE_CLASS[a.kind]}`}>{a.text}</p>}

            <div className={`set-grid ${weighted ? '' : 'no-weight'}`}>
              <span className="muted small">Set</span>
              {weighted && <span className="muted small">lb</span>}
              <span className="muted small">{unit}</span>
              <span />
              {e.sets.map((s, si) => (
                <SetRow
                  key={si}
                  n={si + 1}
                  set={s}
                  weighted={weighted}
                  placeholder={e.rep_max}
                  onChange={(patch) => updateSet(ei, si, patch)}
                  onToggle={() => toggleDone(ei, si)}
                />
              ))}
            </div>
            <div className="row">
              <button
                className="btn link small"
                onClick={() => update(w.exercises.map((x, i) => (i === ei ? { ...x, sets: [...x.sets, { ...x.sets[x.sets.length - 1], done: false }] } : x)))}
              >
                + Add set
              </button>
              {e.sets.length > 1 && (
                <button className="btn link small" onClick={() => update(w.exercises.map((x, i) => (i === ei ? { ...x, sets: x.sets.slice(0, -1) } : x)))}>
                  − Remove set
                </button>
              )}
            </div>
          </section>
        )
      })}

      <button className="btn secondary" onClick={() => setAdding(true)}>
        + Add exercise
      </button>

      <div className="footer-bar">
        <small className="muted">{setsDone(w)} {setsDone(w) === 1 ? 'set' : 'sets'} done</small>
        <button className="btn" onClick={finish}>
          Finish
        </button>
      </div>
    </div>
  )
}

function SetRow({
  n,
  set,
  weighted,
  placeholder,
  onChange,
  onToggle,
}: {
  n: number
  set: LoggedSet
  weighted: boolean
  placeholder: number
  onChange: (p: Partial<LoggedSet>) => void
  onToggle: () => void
}) {
  const numOrNull = (v: string) => (v === '' ? null : Number(v))
  return (
    <>
      <span className="set-n">{n}</span>
      {weighted && (
        <input type="number" inputMode="decimal" aria-label={`Set ${n} weight`} value={set.weight ?? ''} onChange={(e) => onChange({ weight: numOrNull(e.target.value) })} />
      )}
      <input type="number" inputMode="numeric" aria-label={`Set ${n} reps`} placeholder={String(placeholder)} value={set.reps ?? ''} onChange={(e) => onChange({ reps: numOrNull(e.target.value) })} />
      <button className={`check ${set.done ? 'on' : ''}`} aria-label={`Set ${n} done`} aria-pressed={set.done} onClick={onToggle}>
        ✓
      </button>
    </>
  )
}
