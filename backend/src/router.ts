// Dispatches { action, token, ...params } to the handler modules.
import { ApiError, caller, HOUSEHOLD_AUTHED, HOUSEHOLD_PUBLIC, type Env, type Params } from './api'
import { NUTRITION_AUTHED, recomputeTargets } from './nutrition'
import { TRAINING_AUTHED } from './training'

const PUBLIC = HOUSEHOLD_PUBLIC
const AUTHED = { ...HOUSEHOLD_AUTHED, ...NUTRITION_AUTHED, ...TRAINING_AUTHED }

/** Actions that change inputs to someone's targets, and whose targets. */
const RECOMPUTE: Record<string, (p: Params, myId: string, result: unknown) => string> = {
  savePrivate: (p, myId) => String(p.member_id ?? myId),
  saveSettings: (p, myId) => String(p.member_id ?? myId),
  saveGuardian: (p) => String(p.child_id),
  addChild: (_p, _myId, r) => (r as { id: string }).id,
  saveMeasurement: (p, myId) => String((p.measurement as { member_id?: string } | undefined)?.member_id ?? myId),
}

export function handle(env: Env, body: Params): { ok: true; data: unknown } | { ok: false; error: string; code: string } {
  try {
    const action = String(body.action ?? '')
    if (PUBLIC[action]) return { ok: true, data: PUBLIC[action](env, body) }
    if (AUTHED[action]) {
      const me = caller(env, body.token)
      const data = AUTHED[action](env, me, body)
      if (RECOMPUTE[action]) recomputeTargets(env, RECOMPUTE[action](body, me.id, data))
      return { ok: true, data }
    }
    throw new ApiError('not_found', `Unknown action "${action}"`)
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: e.message, code: e.code }
    console.error(e)
    return { ok: false, error: 'Something went wrong. Try again.', code: 'server' }
  }
}
