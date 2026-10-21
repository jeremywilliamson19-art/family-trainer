import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ScheduleEditor } from '../components/ScheduleEditor'
import { SportPicker } from '../components/SportPicker'
import { Toggle } from '../components/Toggle'
import { supabase } from '../lib/supabase'
import type { ChildGuardianSettings, Member, MemberPrivate, MemberSettings } from '../lib/types'
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
    const { data, error } = await supabase.rpc('create_pairing_code', { p_child_id: childId })
    if (error) setError(error.message)
    else setCode(data)
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
  const kid = useRow<Member>('members', 'id', id)
  const body = useRow<MemberPrivate>('member_private', 'member_id', id)
  const settings = useRow<MemberSettings>('member_settings', 'member_id', id)
  const guard = useRow<ChildGuardianSettings>('child_guardian_settings', 'child_id', id)
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
