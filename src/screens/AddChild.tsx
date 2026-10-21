import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScheduleEditor } from '../components/ScheduleEditor'
import { SportPicker } from '../components/SportPicker'
import { Toggle } from '../components/Toggle'
import { api } from '../lib/api'
import type { Day, DayType } from '../lib/types'

export function AddChild() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [feet, setFeet] = useState('')
  const [inches, setInches] = useState('')
  const [weight, setWeight] = useState('')
  const [sports, setSports] = useState<string[]>(['football', 'basketball', 'rugby'])
  const [schedule, setSchedule] = useState<Partial<Record<Day, DayType>>>({ mon: 'home', wed: 'home', fri: 'home' })
  const [inSeason, setInSeason] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { id } = await api<{ id: string }>('addChild', {
        display_name: name,
        age_years: Number(age),
        height_in: Number(feet) * 12 + Number(inches || 0),
        weight_lb: Number(weight),
        sports,
        weekly_schedule: schedule,
        in_season: inSeason,
      })
      nav(`/admin/child/${id}`, { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <form className="screen" onSubmit={submit}>
      <h1>Add child</h1>
      <p className="muted">
        His phone signs in with a pairing code, so he doesn’t need an email.
      </p>

      <section className="card stack">
        <label className="field">
          <span>Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Age</span>
          <input required type="number" inputMode="numeric" min={5} max={17} value={age} onChange={(e) => setAge(e.target.value)} />
        </label>
        <div className="field">
          <span>Height</span>
          <div className="row inline-fields">
            <label>
              <input required type="number" inputMode="numeric" min={3} max={7} value={feet} onChange={(e) => setFeet(e.target.value)} /> ft
            </label>
            <label>
              <input type="number" inputMode="numeric" min={0} max={11} value={inches} onChange={(e) => setInches(e.target.value)} /> in
            </label>
          </div>
        </div>
        <label className="field">
          <span>Weight (lb)</span>
          <input required type="number" inputMode="decimal" min={30} max={350} value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
      </section>

      <section className="card stack">
        <h2>Sports</h2>
        <SportPicker value={sports} onChange={setSports} />
        <Toggle label="In season" hint="Less volume, lifting 2 days a week" checked={inSeason} onChange={setInSeason} />
      </section>

      <section className="card stack">
        <h2>Training days</h2>
        <ScheduleEditor value={schedule} onChange={setSchedule} />
      </section>

      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={busy}>
        {busy ? 'Creating…' : 'Create account'}
      </button>
    </form>
  )
}
