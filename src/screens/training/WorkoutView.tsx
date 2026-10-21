import { Link, useNavigate, useParams } from 'react-router-dom'
import { ExerciseLink } from '../../components/ExerciseLink'
import { exercise } from '../../lib/exercises'
import { mutateTraining, useTraining } from '../../lib/trainingStore'

/** A finished workout, read-only. */
export function WorkoutView() {
  const { id } = useParams()
  const nav = useNavigate()
  const { workouts } = useTraining()
  const w = workouts.find((x) => x.id === id)
  if (!w) return <div className="screen"><p className="muted">Workout not found.</p></div>
  return (
    <div className="screen">
      <Link to="/train" className="back">
        ‹ Train
      </Link>
      <h1>{w.name}</h1>
      <p className="muted">{new Date(`${w.date}T12:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      {w.exercises.map((e, i) => {
        const ex = exercise(e.exercise_id)
        return (
          <section key={i} className="card">
            <strong><ExerciseLink id={e.exercise_id} /></strong>
            {e.form_good && <small className="ok"> · form ✓</small>}
            <p className="muted small">
              {e.sets
                .filter((s) => s.done)
                .map((s) => `${s.weight && ex.load !== 'bodyweight' ? `${s.weight} lb × ` : ''}${s.reps}`)
                .join(' · ')}
            </p>
          </section>
        )
      })}
      <button
        className="btn secondary danger"
        onClick={() => {
          if (confirm('Delete this workout?')) {
            mutateTraining({ type: 'deleteWorkout', id: w.id })
            nav('/train', { replace: true })
          }
        }}
      >
        Delete workout
      </button>
    </div>
  )
}
