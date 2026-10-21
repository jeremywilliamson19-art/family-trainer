import { useEffect, useState } from 'react'

/**
 * Countdown bar above the tab bar. Based on an end time, so it stays right
 * after the phone sleeps or the app is backgrounded.
 */
export function RestTimer({ endsAt, onChange }: { endsAt: number | null; onChange: (endsAt: number | null) => void }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!endsAt) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [endsAt])

  const left = endsAt ? Math.ceil((endsAt - now) / 1000) : 0
  useEffect(() => {
    if (endsAt && left === 0) navigator.vibrate?.([200, 100, 200])
  }, [endsAt, left])
  if (!endsAt) return null

  const done = left <= 0
  const mm = Math.floor(Math.max(0, left) / 60)
  const ss = String(Math.max(0, left) % 60).padStart(2, '0')
  return (
    <div className={`rest-timer ${done ? 'done' : ''}`}>
      <span className="time">{done ? 'Go! 💪' : `Rest ${mm}:${ss}`}</span>
      {!done && (
        <button className="btn small secondary" onClick={() => onChange(endsAt + 30_000)}>
          +30s
        </button>
      )}
      <button className="btn small secondary" onClick={() => onChange(null)}>
        {done ? 'Close' : 'Skip'}
      </button>
    </div>
  )
}
