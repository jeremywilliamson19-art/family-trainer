import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMember } from '../lib/session'
import { api } from '../lib/api'
import type { Member } from '../lib/types'

interface Invite {
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
    try {
      const [m, i] = await Promise.all([api<Member[]>('listMembers'), api<Invite[]>('listInvites')])
      setMembers(m)
      setInvites(i)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const invite = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('invite', { email, display_name: name })
    } catch (e) {
      setError((e as Error).message)
      return
    } finally {
      setBusy(false)
    }
    setEmail('')
    setName('')
    load()
  }

  const revoke = async (email: string) => {
    await api('revokeInvite', { email }).catch((e) => setError((e as Error).message))
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
                <li key={i.email} className="row">
                  <span>
                    {i.display_name ?? i.email}
                    {i.display_name && <small className="muted block">{i.email}</small>}
                  </span>
                  <button className="btn small secondary" onClick={() => revoke(i.email)}>
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
