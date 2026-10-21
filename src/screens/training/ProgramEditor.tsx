import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ExercisePicker } from '../../components/training/ExercisePicker'
import { api } from '../../lib/api'
import { exercise } from '../../lib/exercises'
import { mutateTraining, useTraining } from '../../lib/trainingStore'
import type { MemberSettings, Program, ProgramExercise } from '../../lib/types'
import { useSettings } from '../../lib/useSettings'

/**
 * Edit a program. Your own (/train/program/:id), or, for a parent, the son's
 * (/train/program/:id?member=<childId>), which saves straight to the server.
 */
export function ProgramEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const childId = params.get('member')
  const nav = useNavigate()
  const own = useTraining()
  const mySettings = useSettings()
  const [program, setProgram] = useState<Program | null>(null)
  const [equipment, setEquipment] = useState<string[]>([])
  const [adding, setAdding] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (childId) {
      api<{ programs: Program[] }>('trainingSync', { member_id: childId, from: '9999-01-01' }).then(
        (r) => setProgram(structuredClone(r.programs.find((p) => p.id === id) ?? null)),
        (e) => setError((e as Error).message),
      )
      api<MemberSettings>('getSettings', { member_id: childId }).then((s) => setEquipment(s.home_equipment), () => {})
    } else if (!program) {
      const p = own.programs.find((x) => x.id === id)
      if (p) setProgram(structuredClone(p))
    }
  }, [childId, id, own.programs, program])

  useEffect(() => {
    if (!childId && mySettings) setEquipment(mySettings.home_equipment)
  }, [childId, mySettings])

  if (!program) return <div className="screen">{error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}</div>

  const setDay = (di: number, exercises: ProgramExercise[]) =>
    setProgram({ ...program, days: program.days.map((d, i) => (i === di ? { ...d, exercises } : d)) })
  const setEx = (di: number, ei: number, patch: Partial<ProgramExercise>) =>
    setDay(di, program.days[di].exercises.map((e, i) => (i === ei ? { ...e, ...patch } : e)))
  const move = (di: number, ei: number, by: number) => {
    const list = [...program.days[di].exercises]
    const [x] = list.splice(ei, 1)
    list.splice(Math.max(0, Math.min(list.length, ei + by)), 0, x)
    setDay(di, list)
  }

  const save = async () => {
    const next = { ...program, updated_at: new Date().toISOString() }
    if (childId) {
      setBusy(true)
      try {
        await api('saveProgram', { program: next })
        nav(`/admin/child/${childId}`, { replace: true })
      } catch (e) {
        setError((e as Error).message)
        setBusy(false)
      }
    } else {
      mutateTraining({ type: 'saveProgram', program: next })
      nav('/train', { replace: true })
    }
  }

  if (adding !== null) {
    return (
      <ExercisePicker
        location={program.location}
        equipment={equipment}
        youthOnly={program.youth}
        onClose={() => setAdding(null)}
        onPick={(ex) => {
          setDay(adding, [...program.days[adding].exercises, { exercise_id: ex.id, sets: 3, rep_min: 8, rep_max: 12, rest_s: 90, ...(program.youth ? { rpe: 7 } : {}) }])
          setAdding(null)
        }}
      />
    )
  }

  const num = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(v) || lo))

  return (
    <div className="screen with-footer">
      <Link to={childId ? `/admin/child/${childId}` : '/train'} className="back">
        ‹ Back
      </Link>
      <label className="field">
        <span>Program name</span>
        <input value={program.name} onChange={(e) => setProgram({ ...program, name: e.target.value })} />
      </label>
      {!program.youth && (
        <div className="segmented">
          {(['gym', 'home'] as const).map((l) => (
            <button key={l} className={program.location === l ? 'on' : ''} onClick={() => setProgram({ ...program, location: l })}>
              {l === 'gym' ? 'Gym days' : 'Home days'}
            </button>
          ))}
        </div>
      )}
      {program.youth && <p className="muted small">Youth rules always apply: effort capped at 8, landing drills before jumps, and the foot-contact limit.</p>}

      {program.days.map((d, di) => (
        <section key={di} className="card stack">
          <input className="day-name" value={d.name} aria-label="Day name" onChange={(e) => setProgram({ ...program, days: program.days.map((x, i) => (i === di ? { ...x, name: e.target.value } : x)) })} />
          {d.exercises.map((e, ei) => (
            <div key={ei} className="prog-ex">
              <div className="row">
                <strong>{exercise(e.exercise_id).name}</strong>
                <span className="row-actions">
                  <button className="btn link small" aria-label="Move up" disabled={ei === 0} onClick={() => move(di, ei, -1)}>↑</button>
                  <button className="btn link small" aria-label="Move down" disabled={ei === d.exercises.length - 1} onClick={() => move(di, ei, 1)}>↓</button>
                  <button className="btn link small" aria-label="Remove" onClick={() => setDay(di, d.exercises.filter((_, i) => i !== ei))}>✕</button>
                </span>
              </div>
              <div className="prog-fields">
                <label>Sets<input type="number" inputMode="numeric" value={e.sets} onChange={(v) => setEx(di, ei, { sets: num(v.target.value, 1, 10) })} /></label>
                <label>Reps<input type="number" inputMode="numeric" value={e.rep_min} onChange={(v) => setEx(di, ei, { rep_min: num(v.target.value, 1, 120) })} /></label>
                <label>to<input type="number" inputMode="numeric" value={e.rep_max} onChange={(v) => setEx(di, ei, { rep_max: num(v.target.value, 1, 120) })} /></label>
                <label>Rest s<input type="number" inputMode="numeric" value={e.rest_s} onChange={(v) => setEx(di, ei, { rest_s: num(v.target.value, 0, 600) })} /></label>
                {program.youth && (
                  <label>Effort<input type="number" inputMode="numeric" min={1} max={8} value={e.rpe ?? 7} onChange={(v) => setEx(di, ei, { rpe: num(v.target.value, 1, 8) })} /></label>
                )}
              </div>
            </div>
          ))}
          <button className="btn link" onClick={() => setAdding(di)}>
            + Add exercise
          </button>
        </section>
      ))}

      {error && <p className="error">{error}</p>}
      <div className="footer-bar">
        <span />
        <button className="btn" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save program'}
        </button>
      </div>
    </div>
  )
}
