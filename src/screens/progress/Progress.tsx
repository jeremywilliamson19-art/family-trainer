import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DailyBars } from '../../components/nutrition/DailyBars'
import { TrendChart } from '../../components/progress/TrendChart'
import { api } from '../../lib/api'
import { formatResult, TEST_BY_ID } from '../../lib/agility'
import { localDate } from '../../lib/nutrition'
import { bodyChange, goalProgress, liftProgress, series, testProgress, workoutStats, type LiftProgress } from '../../lib/progress'
import { useMember } from '../../lib/session'
import { newId } from '../../lib/syncStore'
import { mutateTraining, useTraining } from '../../lib/trainingStore'
import type { Measurement, Member, MemberPrivate, TestRecord, Workout } from '../../lib/types'

interface Data {
  workouts: Workout[]
  tests: TestRecord[]
  measurements: Measurement[]
}

const prettyDate = (d: string) => new Date(`${d}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const signed = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`

/** Workout log, body trend, lifts and tests, each from its baseline. */
export function Progress() {
  const me = useMember()
  const [params, setParams] = useSearchParams()
  const who = params.get('who') ?? me.id
  const forOther = who !== me.id
  const own = useTraining()
  const [members, setMembers] = useState<Member[]>([])
  const [other, setOther] = useState<Data | null>(null)
  const [goal, setGoal] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (me.role === 'admin') api<Member[]>('listMembers').then((m) => setMembers(m.filter((x) => x.id === me.id || x.guardian_id === me.id)), () => {})
  }, [me])

  const load = () => {
    if (!forOther) return
    setOther(null)
    api<Data>('trainingSync', { member_id: who, from: '0000-00-00' }).then(setOther, (e) => setError((e as Error).message))
  }
  useEffect(load, [forOther, who])

  useEffect(() => {
    if (me.role === 'child') return setGoal(null)
    api<MemberPrivate>('getPrivate', { member_id: who }).then((p) => setGoal(p.goal_weight_lb), () => setGoal(null))
  }, [who, me.role])

  const data: Data = forOther ? (other ?? { workouts: [], tests: [], measurements: [] }) : own
  const athlete = members.find((m) => m.id === who)
  const youth = forOther ? athlete?.role === 'child' : me.role === 'child'
  const seesBody = me.role !== 'child'
  const today = localDate()

  const stats = useMemo(() => workoutStats(data.workouts, today), [data.workouts, today])
  const lifts = useMemo(() => liftProgress(data.workouts, youth), [data.workouts, youth])
  const tests = useMemo(() => testProgress(data.tests), [data.tests])
  const weight = useMemo(() => series(data.measurements, 'weight_lb'), [data.measurements])
  const waist = useMemo(() => series(data.measurements, 'waist_in'), [data.measurements])
  const chest = useMemo(() => series(data.measurements, 'chest_in'), [data.measurements])
  const height = useMemo(() => series(data.measurements, 'height_in'), [data.measurements])

  const saveEntry = async (m: Measurement) => {
    if (forOther) {
      await api('saveMeasurement', { measurement: m })
      load()
    } else mutateTraining({ type: 'saveMeasurement', measurement: m })
  }

  const removeEntry = async (m: Measurement) => {
    if (!confirm('Delete this entry?')) return
    if (forOther) {
      await api('deleteMeasurement', { id: m.id })
      load()
    } else mutateTraining({ type: 'deleteMeasurement', id: m.id })
  }

  // The son's weight is shown, but as background: his main measures are
  // strength and speed, so Growth comes last and has no goal bar.
  const bodySection = youth ? (
    <section className="card stack">
      <h2>Growth</h2>
      <p className="muted small">Strength and speed above are the main measures. Height and weight are tracked here as background.</p>
      <BodyStat label="Height" unit="in" points={height} />
      <BodyStat label="Weight" unit="lb" points={weight} trend />
      {seesBody && <MeasureForm youth memberId={who} onSave={saveEntry} />}
      {seesBody && <EntryList entries={data.measurements} onDelete={removeEntry} />}
    </section>
  ) : (
    <section className="card stack">
      <h2>Body</h2>
      <BodyStat label="Weight" unit="lb" points={weight} trend goal={goal} lowerIsBetter />
      <BodyStat label="Waist" unit="in" points={waist} lowerIsBetter />
      <BodyStat label="Chest" unit="in" points={chest} />
      <MeasureForm youth={false} memberId={who} onSave={saveEntry} />
      <EntryList entries={data.measurements} onDelete={removeEntry} />
    </section>
  )

  return (
    <div className="screen">
      <h1>Progress</h1>
      {members.length > 1 && (
        <div className="segmented">
          {members.map((m) => (
            <button key={m.id} className={who === m.id ? 'on' : ''} onClick={() => setParams({ who: m.id }, { replace: true })}>
              {m.id === me.id ? 'Me' : m.display_name}
            </button>
          ))}
        </div>
      )}
      {forOther && !other && !error && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {/* ---------------- Workouts ---------------- */}
      <section className="card stack">
        <h2>Workouts</h2>
        <div className="stat-grid three">
          <div className="stat">
            <strong>{stats.total}</strong>
            <span>total</span>
          </div>
          <div className="stat">
            <strong>{stats.thisWeek}</strong>
            <span>this week</span>
          </div>
          <div className="stat">
            <strong>{stats.thisMonth}</strong>
            <span>this month</span>
          </div>
        </div>
        <p className="small">
          🔥 <strong>{stats.streakWeeks}</strong>-week streak{stats.firstDate && <span className="muted"> · training since {prettyDate(stats.firstDate)}</span>}
        </p>
        {stats.total > 0 && (
          <>
            <h3>Per week</h3>
            <DailyBars data={stats.perWeek.map((w) => ({ date: w.week, value: w.count }))} target={null} unit="workouts" label="Workouts" />
            <details>
              <summary className="small">By month</summary>
              <ul className="list">
                {stats.perMonth.map((m) => (
                  <li key={m.month} className="row">
                    <span>{new Date(`${m.month}-15T12:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                    <strong>{m.count}</strong>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </section>

      {!youth && bodySection}
      {/* ---------------- Strength ---------------- */}
      <section className="card stack">
        <h2>Strength</h2>
        <p className="muted small">
          {youth
            ? 'Heaviest weight (or most reps) per exercise, from your first session to your best.'
            : 'Estimated max from your best set (or most reps for bodyweight), first session vs best.'}
        </p>
        {lifts.length === 0 ? <p className="muted">Finish a workout and your lifts show up here.</p> : lifts.map((l) => <LiftRow key={l.exercise_id} l={l} />)}
      </section>

      {/* ---------------- Speed & jump ---------------- */}
      <section className="card stack">
        <h2>Speed &amp; jump</h2>
        {tests.length === 0 ? (
          <p className="muted small">
            No tests yet. <Link to={`/tests?who=${who}`}>Record one</Link>.
          </p>
        ) : (
          tests.map((t) => {
            const def = TEST_BY_ID.get(t.test)!
            return (
              <div key={t.test} className="progress-row">
                <div className="row">
                  <strong>{def.name}</strong>
                  {t.count > 1 && t.improvement !== 0 && (
                    <span className={t.improvement > 0 ? 'ok small' : 'warn-text small'}>
                      {t.improvement > 0 ? '▲' : '▼'} {def.unit === 's' ? `${Math.abs(t.improvement).toFixed(2)} s faster` : `${Math.abs(t.improvement).toFixed(1)}″ higher`}
                    </span>
                  )}
                </div>
                <small className="muted">
                  Baseline {formatResult(def, t.baseline.value)} ({prettyDate(t.baseline.date)}) → best <strong>{formatResult(def, t.best.value)}</strong>
                  {t.latest.id !== t.best.id && ` · latest ${formatResult(def, t.latest.value)}`} · {t.count} test{t.count === 1 ? '' : 's'}
                </small>
              </div>
            )
          })
        )}
      </section>
      {youth && bodySection}
    </div>
  )
}

function BodyStat({ label, unit, points, trend, goal, lowerIsBetter }: { label: string; unit: string; points: ReturnType<typeof series>; trend?: boolean; goal?: number | null; lowerIsBetter?: boolean }) {
  const c = bodyChange(points, !!trend)
  if (!c) return <p className="muted small">{label}: no entries yet.</p>
  const good = c.change === 0 ? null : lowerIsBetter ? c.change < 0 : c.change > 0
  const gp = goal ? goalProgress(c.baseline.value, c.current.value, goal) : null
  return (
    <div className="progress-row">
      <div className="row">
        <strong>{label}</strong>
        <span className={good === null || points.length < 2 ? 'muted small' : good ? 'ok small' : 'warn-text small'}>
          {points.length > 1 ? `${signed(c.change)} ${unit} (${signed(c.pct)}%)` : 'first entry'}
        </span>
      </div>
      <small className="muted">
        Baseline {c.baseline.value} {unit} ({prettyDate(c.baseline.date)}) → now <strong>{c.current.value.toFixed(1)} {unit}</strong>
        {trend && points.length > 1 && ' (7-day average)'}
      </small>
      {gp !== null && (
        <div className="goal-bar">
          <div className="bar">
            <div style={{ width: `${gp}%` }} />
          </div>
          <small className="muted">
            {Math.round(gp)}% of the way to {goal} {unit}
          </small>
        </div>
      )}
      {points.length > 1 && <TrendChart points={trend ? points : points.map(({ date, value }) => ({ date, value }))} unit={unit} goal={goal ?? null} label={label} />}
    </div>
  )
}

function LiftRow({ l }: { l: LiftProgress }) {
  const [open, setOpen] = useState(false)
  const unit = l.measure === 'reps' ? (l.best.label.includes('sec') ? 'sec' : 'reps') : 'lb'
  return (
    <div className="progress-row">
      <button className="row lift-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <strong>{l.name}</strong>
        <span className={l.change > 0 ? 'ok small' : 'muted small'}>
          {l.sessions > 1 ? `${signed(l.change, 0)} ${unit} (${signed(l.pct, 0)}%)` : 'first session'}
        </span>
      </button>
      <small className="muted">
        Baseline {l.baseline.label} → best <strong>{l.best.label}</strong>
        {l.measure === 'e1rm' && ` (est. max ${l.baseline.value} → ${l.best.value} lb)`} · {l.sessions} session{l.sessions === 1 ? '' : 's'}
      </small>
      {open && <TrendChart points={l.history} unit={unit} decimals={0} label={l.name} />}
    </div>
  )
}

function MeasureForm({ youth, memberId, onSave }: { youth: boolean; memberId: string; onSave: (m: Measurement) => Promise<void> | void }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(localDate())
  const [weight, setWeight] = useState('')
  const [waist, setWaist] = useState('')
  const [chest, setChest] = useState('')
  const [height, setHeight] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!open)
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        + {youth ? 'Log weight / height' : 'Log weigh-in'}
      </button>
    )
  const n = (v: string) => (v === '' ? null : Number(v))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await onSave({ id: newId(), member_id: memberId, date, weight_lb: n(weight), waist_in: youth ? null : n(waist), chest_in: youth ? null : n(chest), height_in: youth ? n(height) : null })
      setOpen(false)
      setWeight('')
      setWaist('')
      setChest('')
      setHeight('')
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <form className="stack measure-form" onSubmit={submit}>
      <label className="field">
        <span>Date</span>
        <input type="date" value={date} max={localDate()} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="macro-inputs">
        <label className="field">
          <span>Weight (lb)</span>
          <input type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        {youth ? (
          <label className="field">
            <span>Height (in)</span>
            <input type="number" inputMode="decimal" step="0.25" value={height} onChange={(e) => setHeight(e.target.value)} />
          </label>
        ) : (
          <>
            <label className="field">
              <span>Waist (in)</span>
              <input type="number" inputMode="decimal" step="0.25" value={waist} onChange={(e) => setWaist(e.target.value)} />
            </label>
            <label className="field">
              <span>Chest (in)</span>
              <input type="number" inputMode="decimal" step="0.25" value={chest} onChange={(e) => setChest(e.target.value)} />
            </label>
          </>
        )}
      </div>
      <p className="muted small">
        {youth ? 'Only you see his weight. He sees his height.' : 'Weigh in the morning, after the bathroom, before eating. Your targets update from your latest weight.'}
      </p>
      {error && <p className="error">{error}</p>}
      <button className="btn">Save</button>
      <button type="button" className="btn link" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  )
}

function EntryList({ entries, onDelete }: { entries: Measurement[]; onDelete: (m: Measurement) => void }) {
  if (!entries.length) return null
  return (
    <details>
      <summary className="small">All entries</summary>
      <ul className="list">
        {[...entries].sort((a, b) => b.date.localeCompare(a.date)).map((m) => (
          <li key={m.id} className="row small">
            <span>{prettyDate(m.date)}</span>
            <span className="muted">
              {[m.weight_lb && `${m.weight_lb} lb`, m.waist_in && `waist ${m.waist_in}″`, m.chest_in && `chest ${m.chest_in}″`, m.height_in && `${m.height_in}″ tall`].filter(Boolean).join(' · ')}
            </span>
            <button className="btn link small" aria-label="Delete entry" onClick={() => onDelete(m)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
