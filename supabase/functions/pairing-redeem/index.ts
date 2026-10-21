// A child's phone trades a pairing code for a one-time sign-in token.
// Called without a session, so JWT verification is off for this function
// (see config.toml); the code itself is the credential.
import { adminClient, HttpError, json, serve } from '../_shared/http.ts'

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  const { code } = await req.json().catch(() => ({}))
  const normalized = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (normalized.length !== 8) throw new HttpError(400, 'Pairing codes are 8 characters')

  const db = adminClient()
  // Claim the code atomically so it can only be used once.
  const { data: row } = await db
    .from('pairing_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code_hash', await sha256Hex(normalized))
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('child_id')
    .maybeSingle()
  if (!row) throw new HttpError(400, "That code didn't work. It may have expired — ask for a new one.")

  const { data: child } = await db.auth.admin.getUserById(row.child_id)
  if (!child.user?.email) throw new HttpError(400, 'Child account not found')

  const { data: link, error } = await db.auth.admin.generateLink({ type: 'magiclink', email: child.user.email })
  if (error) throw error
  return json({ token_hash: link.properties.hashed_token })
})
