import { useEffect, useState } from 'react'
import { ChipList } from '../components/ChipList'
import { DeviceAlerts } from '../components/DeviceAlerts'
import { Equipment } from '../components/Equipment'
import { ScheduleEditor } from '../components/ScheduleEditor'
import { Toggle } from '../components/Toggle'
import { useMember, useSession } from '../lib/session'
import { supabase } from '../lib/supabase'
import type { MemberSettings } from '../lib/types'
import { useRow } from '../lib/useRow'

export function Settings() {
  const member = useMember()
  const { reload, signOut } = useSession()
  const { row: s, save, error } = useRow<MemberSettings>('member_settings', 'member_id', member.id)
  const [name, setName] = useState(member.display_name)
  const isChild = member.role === 'child'

  useEffect(() => {
    if (location.hash === '#devices') document.getElementById('devices')?.scrollIntoView()
  }, [])

  const saveName = async () => {
    const v = name.trim()
    if (!v || v === member.display_name) return
    await supabase.from('members').update({ display_name: v }).eq('id', member.id)
    reload()
  }

  return (
    <div className="screen">
      <h1>Settings</h1>
      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>Profile</h2>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} />
        </label>
      </section>

      <section className="card" id="devices">
        <h2>Devices &amp; alerts</h2>
        <DeviceAlerts />
      </section>

      {s && !isChild && (
        <>
          <section className="card">
            <h2>What I track</h2>
            <Toggle label="Food" checked={s.track_food} onChange={(v) => save({ track_food: v })} />
            <Toggle label="Workouts" checked={s.track_workouts} onChange={(v) => save({ track_workouts: v })} />
            {!s.track_food && !s.track_workouts && (
              <p className="muted">Recipe book only. You can turn tracking on any time.</p>
            )}
          </section>

          {s.track_workouts && (
            <>
              <section className="card">
                <h2>My week</h2>
                <p className="muted">Tap a day to switch between rest, gym and home.</p>
                <ScheduleEditor value={s.weekly_schedule} onChange={(v) => save({ weekly_schedule: v })} />
              </section>
              <section className="card">
                <h2>Home equipment</h2>
                <Equipment value={s.home_equipment} onChange={(v) => save({ home_equipment: v })} />
              </section>
            </>
          )}

          {s.track_food && (
            <section className="card">
              <h2>Foods I don’t eat</h2>
              <p className="muted">Suggestions will never include these.</p>
              <ChipList value={s.dislikes} onChange={(v) => save({ dislikes: v })} placeholder="e.g. mushrooms" />
            </section>
          )}
        </>
      )}

      {s && (
        <section className="card">
          <h2>Family feed</h2>
          <p className="muted">Choose which wins the family sees.</p>
          <Toggle label="Workouts completed" checked={s.feed_workouts} onChange={(v) => save({ feed_workouts: v })} />
          <Toggle label="Personal records" checked={s.feed_prs} onChange={(v) => save({ feed_prs: v })} />
          <Toggle label="Jump & sprint bests" checked={s.feed_test_bests} onChange={(v) => save({ feed_test_bests: v })} />
          <Toggle label="Goal streaks" checked={s.feed_streaks} onChange={(v) => save({ feed_streaks: v })} />
          {!isChild && (
            <Toggle
              label="Weight & measurements"
              hint="Off by default"
              checked={s.feed_body}
              onChange={(v) => save({ feed_body: v })}
            />
          )}
        </section>
      )}

      <section className="card">
        <button
          className="btn secondary danger"
          onClick={() => {
            const msg = isChild
              ? 'Sign out? You’ll need a new pairing code from a parent to get back in.'
              : 'Sign out of this device?'
            if (confirm(msg)) signOut()
          }}
        >
          Sign out
        </button>
      </section>
    </div>
  )
}
