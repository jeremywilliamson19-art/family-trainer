import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toggle } from '../../components/Toggle'
import { api } from '../../lib/api'
import { ACTIVITY, computeTargets, isCompleteProfile, type ActivityLevel, type Profile } from '../../lib/macros'
import { refresh } from '../../lib/nutritionStore'
import type { MemberPrivate, MemberSettings } from '../../lib/types'
import { invalidateSettings } from '../../lib/useSettings'

/** Onboarding for adults who track food: profile in, targets out. */
export function TargetsSetup() {
  const nav = useNavigate()
  const [sex, setSex] = useState<'male' | 'female' | ''>('')
  const [age, setAge] = useState('')
  const [feet, setFeet] = useState('')
  const [inches, setInches] = useState('')
  const [weight, setWeight] = useState('')
  const [goal, setGoal] = useState('')
  const [activity, setActivity] = useState<ActivityLevel | ''>('')
  const [adjust, setAdjust] = useState(true)
  const [settings, setSettings] = useState<MemberSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prefill from anything already saved.
  useEffect(() => {
    api<MemberPrivate>('getPrivate').then((p) => {
      if (p.sex) setSex(p.sex)
      if (p.age_years) setAge(String(p.age_years))
      if (p.height_in) {
        setFeet(String(Math.floor(p.height_in / 12)))
        setInches(String(Math.round(p.height_in % 12)))
      }
      if (p.weight_lb) setWeight(String(p.weight_lb))
      if (p.goal_weight_lb) setGoal(String(p.goal_weight_lb))
      if (p.activity_level) setActivity(p.activity_level as ActivityLevel)
    }, () => {})
    api<MemberSettings>('getSettings').then((s) => {
      setSettings(s)
      setAdjust(s.training_adjust)
    }, () => {})
  }, [])

  const profile: Partial<Profile> = {
    sex: sex || undefined,
    age_years: Number(age) || undefined,
    height_in: Number(feet) * 12 + Number(inches || 0) || undefined,
    weight_lb: Number(weight) || undefined,
    goal_weight_lb: Number(goal) || null,
    activity_level: activity || undefined,
  }
  const preview = useMemo(
    () => (isCompleteProfile(profile) ? computeTargets(profile, settings?.weekly_schedule ?? {}, adjust) : null),
    [sex, age, feet, inches, weight, goal, activity, adjust, settings],
  )

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!isCompleteProfile(profile)) return
    setBusy(true)
    setError(null)
    try {
      await api('saveSettings', { patch: { training_adjust: adjust } })
      await api('savePrivate', { patch: profile })
      invalidateSettings()
      await refresh()
      nav('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <form className="screen" onSubmit={save}>
      <h1>Your targets</h1>

      <section className="card stack">
        <div className="field">
          <span>Sex (for the calorie formula)</span>
          <div className="segmented">
            {(['male', 'female'] as const).map((s) => (
              <button type="button" key={s} className={sex === s ? 'on' : ''} onClick={() => setSex(s)}>
                {s === 'male' ? 'Male' : 'Female'}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Age</span>
          <input required type="number" inputMode="numeric" min={13} max={100} value={age} onChange={(e) => setAge(e.target.value)} />
        </label>
        <div className="field">
          <span>Height</span>
          <div className="row inline-fields">
            <label>
              <input required type="number" inputMode="numeric" min={4} max={7} value={feet} onChange={(e) => setFeet(e.target.value)} /> ft
            </label>
            <label>
              <input type="number" inputMode="numeric" min={0} max={11} value={inches} onChange={(e) => setInches(e.target.value)} /> in
            </label>
          </div>
        </div>
        <label className="field">
          <span>Current weight (lb)</span>
          <input required type="number" inputMode="decimal" min={80} max={600} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label className="field">
          <span>Goal weight (lb, optional)</span>
          <input type="number" inputMode="decimal" min={80} max={600} step="0.1" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </label>
      </section>

      <section className="card stack">
        <h2>Activity level</h2>
        {(Object.keys(ACTIVITY) as ActivityLevel[]).map((a) => (
          <button type="button" key={a} className={`choice ${activity === a ? 'on' : ''}`} onClick={() => setActivity(a)}>
            <strong>{ACTIVITY[a].label}</strong>
            <small className="muted block">{ACTIVITY[a].hint}</small>
          </button>
        ))}
      </section>

      <section className="card">
        <Toggle
          label="Training-day carbs"
          hint="+10% carbs on workout days, less on rest days. Weekly calories stay the same."
          checked={adjust}
          onChange={setAdjust}
        />
      </section>

      {preview && (
        <section className="card stack">
          <h2>Your daily targets</h2>
          <div className="target-grid">
            <div className="hero">
              <strong>{preview.protein_g} g</strong>
              <span>protein</span>
            </div>
            <div>
              <strong>{preview.calories.toLocaleString()}</strong>
              <span>calories</span>
            </div>
            <div>
              <strong>{preview.carbs_g} g</strong>
              <span>carbs</span>
            </div>
            <div>
              <strong>{preview.fat_g} g</strong>
              <span>fat</span>
            </div>
          </div>
          <p className="muted small">
            That’s a 20% deficit from your estimated {preview.tdee.toLocaleString()} calories a day: about{' '}
            <strong>{preview.loss_lb_per_week} lb a week</strong>.
          </p>
          {preview.too_fast && (
            <div className="card warn">
              That’s faster than 1% of your body weight a week, which risks losing muscle. Consider a lower activity level if you’re
              unsure, and keep protein high.
            </div>
          )}
          <p className="muted small">
            Fat can’t be spot-reduced: chest and belly fat come off with the overall deficit. Building chest, back and arms and keeping
            protein high is what changes how those areas look.
          </p>
        </section>
      )}

      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={busy || !preview}>
        {busy ? 'Saving…' : 'Save targets'}
      </button>
    </form>
  )
}
