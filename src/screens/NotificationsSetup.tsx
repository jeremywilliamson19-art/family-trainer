import { DeviceAlerts } from '../components/DeviceAlerts'

/** First-run step: get notification permission while the user is here. */
export function NotificationsSetup({ onDone }: { onDone: () => void }) {
  return (
    <div className="screen">
      <h1>Turn on reminders</h1>
      <p className="muted">
        Meal and workout reminders, your evening protein check, and the Sunday report come as notifications. When
        your iPhone asks, tap <strong>Allow</strong>.
      </p>
      <DeviceAlerts />
      <button className="btn secondary" onClick={onDone}>
        Continue
      </button>
    </div>
  )
}
