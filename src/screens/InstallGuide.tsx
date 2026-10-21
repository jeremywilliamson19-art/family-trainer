import { iosVersion, isIOSSafari } from '../lib/platform'

function ShareIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" aria-label="Share" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12M7 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 11v9h14v-9" strokeLinejoin="round" />
    </svg>
  )
}

export function InstallGuide({ onSkip }: { onSkip: () => void }) {
  const version = iosVersion()
  const tooOld = version !== null && version < 16.4

  return (
    <div className="screen">
      <h1>Install Family Trainer</h1>
      <p className="muted">
        Add the app to your Home Screen first. Reminders and notifications only work when it's opened from the
        icon.
      </p>

      {tooOld && (
        <div className="card warn">
          This iPhone is on iOS {version}. Notifications need iOS 16.4 or newer: Settings → General → Software
          Update.
        </div>
      )}

      {!isIOSSafari() ? (
        <div className="card warn">
          Open this page in <strong>Safari</strong> to install. Copy the address, open Safari, and paste it in.
        </div>
      ) : (
        <ol className="steps">
          <li>
            Tap the <strong>Share</strong> button <ShareIcon /> at the bottom of the screen.
          </li>
          <li>
            Scroll down and tap <strong>Add to Home Screen</strong>. If you see <em>Open as Web App</em>, keep it on.
          </li>
          <li>
            Tap <strong>Add</strong>.
          </li>
          <li>Close Safari and open <strong>Trainer</strong> from your Home Screen.</li>
        </ol>
      )}

      <button className="btn link" onClick={onSkip}>
        Continue in the browser instead
      </button>
    </div>
  )
}
