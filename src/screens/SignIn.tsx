import { useState, type FormEvent } from 'react'
import { callFunction, supabase } from '../lib/supabase'

type Mode = 'email' | 'code' | 'pairing'

export function SignIn() {
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
      const msg = (e as Error).message
      setError(/fetch|network|load failed|send a request/i.test(msg) ? 'Can’t reach the server. Check your connection and try again.' : msg)
    } finally {
      setBusy(false)
    }
  }

  const sendCode = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
      if (error) throw error
      setCode('')
      setMode('code')
    })
  }

  const verifyCode = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
      if (error) throw new Error('That code didn’t work. Check the newest email, or send a new code.')
    })
  }

  const redeemPairing = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      const { token_hash } = await callFunction<{ token_hash: string }>('pairing-redeem', { code })
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })
      if (error) throw error
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
          <button type="button" className="btn link" onClick={() => { setCode(''); setMode('pairing') }}>
            I have a pairing code
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
          <p className="muted">Ask a parent to open Family → your name → Generate pairing code.</p>
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
