import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useSession } from '../lib/session'

type Mode = 'email' | 'code' | 'pairing'

export function SignIn() {
  const { signIn } = useSession()
  const [mode, setModeRaw] = useState<Mode>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setMode = (m: Mode) => {
    setError(null)
    setModeRaw(m)
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const sendCode = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      await api('requestCode', { email: email.trim() })
      setCode('')
      setMode('code')
    })
  }

  const verifyCode = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      const { token } = await api<{ token: string }>('verifyCode', { email: email.trim(), code })
      await signIn(token)
    })
  }

  const redeemPairing = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      const { token } = await api<{ token: string }>('redeemPairing', { code })
      await signIn(token)
    })
  }

  return (
    <div className="screen center">
      <h1>Family Trainer</h1>

      {mode === 'email' && (
        <form onSubmit={sendCode} className="stack">
          <label className="field">
            <span>Your email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="btn" disabled={busy}>
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
          <button type="button" className="btn link" disabled={!email.includes('@')} onClick={() => { setCode(''); setMode('code') }}>
            I already have an email code
          </button>
          <button type="button" className="btn link" onClick={() => { setCode(''); setMode('pairing') }}>
            Kid’s phone? Use a pairing code from a parent
          </button>
        </form>
      )}

      {mode === 'code' && (
        <form onSubmit={verifyCode} className="stack">
          <p className="muted">
            We sent a 6-digit code to <strong>{email}</strong>. Type it here. Don’t tap anything in the email.
          </p>
          <input
            className="code-input"
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            aria-label="6-digit code"
          />
          <button className="btn" disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button type="button" className="btn link" onClick={() => setMode('email')}>
            Use a different email or resend
          </button>
        </form>
      )}

      {mode === 'pairing' && (
        <form onSubmit={redeemPairing} className="stack">
          <p className="muted">
            For a kid’s phone. Ask a parent to open Family → your name → Generate pairing code. It’s 8 letters and
            numbers.
          </p>
          <input
            className="code-input"
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={9}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            aria-label="Pairing code"
          />
          {/^\d{6}$/.test(code) && (
            <p className="error">That looks like a 6-digit email code. Tap “Sign in with email instead” below.</p>
          )}
          <button className="btn" disabled={busy}>
            {busy ? 'Checking…' : 'Connect'}
          </button>
          <button type="button" className="btn link" onClick={() => setMode('email')}>
            Sign in with email instead
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  )
}
