import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMember } from '../lib/session'
import { supabase } from '../lib/supabase'
import type { Member } from '../lib/types'

interface Invite {
  id: string
  email: string
  display_name: string | null
  created_at: string
}

const ROLE_LABEL = { admin: 'Admin', adult: 'Adult', child: 'Child account' }

export function Admin() {
  const me = useMember()
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([
      supabase.from('members').select('*').order('created_at'),
      supabase.from('household_invites').select('id, email, display_name, created_at').is('accepted_at', null),
    ])
    setMembers((m.data ?? []) as Member[])
    setInvites((i.data ?? []) as Invite[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const invite = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('invite_member', { p_email: email, p_display_name: name })
    setBusy(false)
    if (error) {
      setError(error.message.includes('duplicate') ? 'That email already has an invite.' : error.message)
      return
    }
    setEmail('')
    setName('')
    load()
  }

  const revoke = async (id: string) => {
    await supabase.from('household_invites').delete().eq('id', id)
    load()
  }

  return (
    <div className="screen">
      <h1>Family</h1>

      <section className="card">
        <h2>Members</h2>
        <ul className="list">
          {members.map((m) => (
            <li key={m.id}>
              {m.role === 'child' ? (
                <Link to={`/admin/child/${m.id}`} className="row link-row">
                  <span>{m.display_name}</span>
                  <span className="muted">{ROLE_LABEL[m.role]} ›</span>
                </Link>
              ) : (
                <div className="row">
                  <span>
                    {m.display_name}
                    {m.id === me.id && ' (you)'}
                  </span>
                  <span className="muted">{ROLE_LABEL[m.role]}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
        <Link to="/admin/add-child" className="btn secondary">
          Add child
        </Link>
      </section>

      <section className="card">
        <h2>Invite an adult</h2>
        <form onSubmit={invite} className="stack">
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Amanda" />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" inputMode="email" autoCapitalize="none" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn" disabled={busy}>
            Add to household
          </button>
          <p className="muted small">
            No email is sent. Tell them to open the app and sign in with this address. They’ll join automatically.
          </p>
          {error && <p className="error">{error}</p>}
        </form>
        {invites.length > 0 && (
          <>
            <h3>Waiting to sign in</h3>
            <ul className="list">
              {invites.map((i) => (
                <li key={i.id} className="row">
                  <span>
                    {i.display_name ?? i.email}
                    {i.display_name && <small className="muted block">{i.email}</small>}
                  </span>
                  <button className="btn small secondary" onClick={() => revoke(i.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
