import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPushState, type PushState } from '../lib/push'

/** Shown at the top of every screen while this device can't get reminders. */
export function PushBanner() {
  const [state, setState] = useState<PushState | null>(null)

  useEffect(() => {
    const check = () => getPushState().then(setState)
    check()
    // Re-check when the user comes back from iOS Settings.
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [])

  if (!state || state === 'subscribed' || state === 'unsupported') return null
  const text =
    state === 'needs-install'
      ? 'Reminders only work from the home-screen app.'
      : state === 'denied'
        ? 'Notifications are off for this app.'
        : 'Reminders are not set up on this device.'
  return (
    <Link to="/settings#devices" className="banner">
      🔕 {text} <strong>Fix it</strong>
    </Link>
  )
}
