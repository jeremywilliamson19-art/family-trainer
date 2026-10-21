import { useEffect, useState } from 'react'
import { enablePush, getPushState, resetPush, sendTestPush, type PushState } from '../lib/push'

const DESCRIPTIONS: Record<PushState, string> = {
  subscribed: 'This device gets reminders.',
  'granted-unsubscribed': 'Allowed, but this device isn’t registered yet.',
  default: 'Not set up on this device yet.',
  denied: 'Notifications are turned off for this app in iPhone Settings.',
  'needs-install': 'Open the app from the Home Screen icon to get notifications.',
  unsupported: 'This browser can’t receive notifications.',
}

/** Status, enable, test and "Fix it" for this device's push subscription. */
export function DeviceAlerts({ onSubscribed }: { onSubscribed?: () => void }) {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    getPushState().then(setState)
  }, [])

  async function act(fn: () => Promise<PushState | void>) {
    setBusy(true)
    setNote(null)
    try {
      const s = await fn()
      if (s) setState(s)
      if (s === 'subscribed') onSubscribed?.()
    } catch (e) {
      setNote((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const test = () =>
    act(async () => {
      const r = await sendTestPush()
      setNote(
        r.sent > 0
          ? `Sent to ${r.sent} device${r.sent === 1 ? '' : 's'}. It should arrive in a few seconds.`
          : 'No devices could be reached. Tap Fix it.',
      )
    })

  if (!state) return null
  return (
    <div className="stack">
      <p className={state === 'subscribed' ? 'ok' : 'muted'}>{DESCRIPTIONS[state]}</p>

      {(state === 'default' || state === 'granted-unsubscribed') && (
        <button className="btn" disabled={busy} onClick={() => act(enablePush)}>
          Enable notifications
        </button>
      )}

      {state === 'denied' && (
        <ol className="steps small">
          <li>Open iPhone <strong>Settings → Notifications</strong>.</li>
          <li>Find <strong>Trainer</strong> and turn on <strong>Allow Notifications</strong>.</li>
          <li>Come back here and tap Fix it.</li>
        </ol>
      )}

      {state === 'subscribed' && (
        <button className="btn" disabled={busy} onClick={test}>
          Send test notification
        </button>
      )}

      {state !== 'unsupported' && state !== 'needs-install' && (
        <button className="btn secondary" disabled={busy} onClick={() => act(resetPush)}>
          Fix it
        </button>
      )}

      {note && <p className="muted">{note}</p>}
    </div>
  )
}
