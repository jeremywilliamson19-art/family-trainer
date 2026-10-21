import type { ReactNode } from 'react'

/** Full-screen centered message for loading, errors and dead ends. */
export function Message({
  title,
  children,
  action,
}: {
  title: string
  children?: ReactNode
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="screen center">
      <h1>{title}</h1>
      {children && <p className="muted">{children}</p>}
      {action && (
        <button className="btn secondary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
