// Admin creates a child account. The child has no email or password of his
// own; his phone signs in with a pairing code (see pairing-redeem).
import { adminClient, HttpError, json, requireUser, serve } from '../_shared/http.ts'

const SPORTS = ['football', 'basketball', 'rugby', 'soccer', 'baseball', 'track', 'wrestling', 'other']
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_TYPES = ['gym', 'home', 'rest']

interface Body {
  display_name: string
  age_years: number
  height_in: number
  weight_lb: number
  sports: string[]
  weekly_schedule: Record<string, string>
  in_season: boolean
}

function validate(b: Partial<Body>): Body {
  const name = String(b.display_name ?? '').trim()
  if (!name || name.length > 40) throw new HttpError(400, 'Enter a name')
  const num = (v: unknown, lo: number, hi: number, label: string) => {
    const n = Number(v)
    if (!Number.isFinite(n) || n < lo || n > hi) throw new HttpError(400, `Check the ${label}`)
    return n
  }
  const schedule: Record<string, string> = {}
  for (const [d, t] of Object.entries(b.weekly_schedule ?? {})) {
    if (DAYS.includes(d) && DAY_TYPES.includes(t)) schedule[d] = t
  }
  return {
    display_name: name,
    age_years: num(b.age_years, 5, 17, 'age'),
    height_in: num(b.height_in, 36, 84, 'height'),
    weight_lb: num(b.weight_lb, 30, 350, 'weight'),
    sports: (b.sports ?? []).filter((s) => SPORTS.includes(s)),
    weekly_schedule: schedule,
    in_season: Boolean(b.in_season),
  }
}

serve(async (req) => {
  const user = await requireUser(req)
  const db = adminClient()

  const { data: me } = await db.from('members').select('household_id, role').eq('id', user.id).single()
  if (me?.role !== 'admin') throw new HttpError(403, 'Only the household admin can add a child')

  const body = validate(await req.json())

  const childEmail = `kid-${crypto.randomUUID()}@family-trainer.invalid`
  const { data: created, error: authErr } = await db.auth.admin.createUser({
    email: childEmail,
    email_confirm: true,
    user_metadata: { child: true },
  })
  if (authErr || !created.user) throw authErr ?? new Error('createUser failed')
  const childId = created.user.id

  try {
    // members first: the other rows reference it.
    const { error: mErr } = await db.from('members').insert({
      id: childId,
      household_id: me.household_id,
      role: 'child',
      display_name: body.display_name,
      guardian_id: user.id,
      sports: body.sports,
      in_season: body.in_season,
      onboarded_at: new Date().toISOString(),
    })
    if (mErr) throw mErr
    for (const q of [
      db.from('member_private').insert({
        member_id: childId,
        age_years: body.age_years,
        height_in: body.height_in,
        weight_lb: body.weight_lb,
      }),
      db.from('member_settings').insert({ member_id: childId, weekly_schedule: body.weekly_schedule }),
      db.from('child_guardian_settings').insert({ child_id: childId }),
    ]) {
      const { error } = await q
      if (error) throw error
    }
  } catch (e) {
    await db.auth.admin.deleteUser(childId) // cascades to the member rows
    throw e
  }

  return json({ id: childId })
})
