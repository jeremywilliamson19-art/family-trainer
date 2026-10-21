import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { EXERCISE_BY_ID, MUSCLES } from '../../lib/exercises'
import { demoUrl, FORM } from '../../lib/formGuide'
import { DRILLS } from '../../lib/pose/coach'
import { liftProgress } from '../../lib/progress'
import { useMember } from '../../lib/session'
import { useTraining } from '../../lib/trainingStore'
import type { Workout } from '../../lib/types'

const EQUIPMENT_LABEL: Record<string, string> = {
  gym: 'Gym equipment',
  barbell: 'Barbell',
  dumbbells: 'Dumbbells',
  pullup_bar: 'Pull-up bar',
  bands: 'Bands',
  bench: 'Bench',
  kettlebell: 'Kettlebell',
  box: 'Box or step',
  medball: 'Medicine ball',
  none: 'No equipment',
}

/** How to do an exercise well, a demo link, and your history with it. */
export function ExercisePage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const me = useMember()
  const who = params.get('who') ?? me.id
  const own = useTraining()
  const [otherWorkouts, setOtherWorkouts] = useState<Workout[] | null>(null)
  const ex = EXERCISE_BY_ID.get(id ?? '')
  const guide = FORM[id ?? '']
  const drill = Object.values(DRILLS).find((d) => d.exercise_id === id)

  useEffect(() => {
    if (who === me.id) return
    api<{ workouts: Workout[] }>('trainingSync', { member_id: who, from: '0000-00-00' }).then((r) => setOtherWorkouts(r.workouts), () => setOtherWorkouts([]))
  }, [who, me.id])

  if (!ex) return <div className="screen"><p className="muted">Exercise not found.</p></div>
  const workouts = who === me.id ? own.workouts : (otherWorkouts ?? [])
  const youthView = me.role === 'child' || who !== me.id
  const history = liftProgress(workouts, youthView).find((l) => l.exercise_id === ex.id)
  const label = (m: string) => MUSCLES.find((x) => x.id === m)?.label ?? m
  const recent = workouts
    .filter((w) => w.finished_at && w.exercises.some((e) => e.exercise_id === ex.id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  return (
    <div className="screen">
      <button className="btn link back-btn" onClick={() => nav(-1)}>
        ‹ Back
      </button>
      <h1>{ex.name}</h1>
      <p className="muted small">
        {[...ex.primary.map(label), ...(ex.secondary ?? []).map((m) => `${label(m)} (some)`)].join(' · ') || 'Conditioning'}
        {' · '}
        {ex.needs.map((n) => EQUIPMENT_LABEL[n] ?? n).join(', ')}
      </p>

      {guide && (
        <section className="card stack">
          <h2>✅ How to do it</h2>
          <ol className="steps">
            {guide.cues.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <h3>⚠️ Watch out for</h3>
          <ul className="mistakes">
            {guide.mistakes.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          {guide.youth && (ex.youth || youthView) && <p className="card warn small">👦 {guide.youth}</p>}
          {drill && (
            <p className="small">
              <strong>As a drill:</strong> {drill.how} <span className="muted">({drill.dose})</span>
            </p>
          )}
          <p className="muted small">Form first: if the last reps look different from the first ones, stop the set there.</p>
        </section>
      )}

      <a className="btn secondary" href={demoUrl(ex.name)} target="_blank" rel="noopener noreferrer">
        ▶️ Watch a demo (YouTube)
      </a>

      <section className="card stack">
        <h2>{who === me.id ? 'Your history' : 'History'}</h2>
        {history ? (
          <p className="small">
            First time {history.baseline.label} → best <strong>{history.best.label}</strong> · {history.sessions} session{history.sessions === 1 ? '' : 's'}
          </p>
        ) : (
          <p className="muted small">Not logged yet.</p>
        )}
        {recent.map((w) => {
          const e = w.exercises.find((x) => x.exercise_id === ex.id)!
          return (
            <div key={w.id} className="row small">
              <span className="muted">{new Date(`${w.date}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              <span>
                {e.sets
                  .filter((s) => s.done)
                  .map((s) => `${s.weight && ex.load !== 'bodyweight' ? `${s.weight}×` : ''}${s.reps}`)
                  .join(', ')}
                {e.form_good ? ' · form ✓' : ''}
              </span>
            </div>
          )
        })}
      </section>
    </div>
  )
}
