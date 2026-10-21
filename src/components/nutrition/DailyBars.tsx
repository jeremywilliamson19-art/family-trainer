import { useState } from 'react'

export interface DayValue {
  date: string
  /** null = nothing logged that day (no bar). */
  value: number | null
}

/**
 * One series of daily bars with a target line. Tap a bar to see its value.
 * Thin bars with rounded tops anchored to the baseline, a 2px gap between
 * bars, recessive axis; the series is named by the card title (no legend).
 */
export function DailyBars({ data, target, unit, label }: { data: DayValue[]; target: number | null; unit: string; label: string }) {
  const [sel, setSel] = useState<number | null>(null)
  const W = 320
  const H = 140
  const top = 18
  const bottom = 20
  const max = Math.max(target ?? 0, ...data.map((d) => d.value ?? 0)) * 1.1 || 1
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max)
  const slot = W / data.length
  const barW = Math.max(3, Math.min(22, slot - 2))
  const fmt = (v: number) => `${Math.round(v).toLocaleString()} ${unit}`
  const dayLabel = (d: string) => new Date(`${d}T12:00`).toLocaleDateString(undefined, { weekday: data.length <= 7 ? 'short' : undefined, month: data.length > 7 ? 'numeric' : undefined, day: data.length > 7 ? 'numeric' : undefined })
  const every = data.length > 14 ? 5 : data.length > 7 ? 2 : 1

  return (
    <figure className="daily-bars">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} per day`}>
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="axis" />
        {data.map((d, i) => {
          if (d.value === null) return null
          const x = i * slot + (slot - barW) / 2
          const h = Math.max(1, y(0) - y(d.value))
          const r = Math.min(4, barW / 2, h)
          // Rounded top, square bottom on the baseline.
          const path = `M${x},${y(0)} V${y(0) - h + r} Q${x},${y(0) - h} ${x + r},${y(0) - h} H${x + barW - r} Q${x + barW},${y(0) - h} ${x + barW},${y(0) - h + r} V${y(0)} Z`
          return (
            <g key={d.date}>
              <path d={path} className={`bar ${sel === i ? 'sel' : ''}`} />
              {/* Hit area bigger than the bar. */}
              <rect x={i * slot} y={top} width={slot} height={H - top - bottom} fill="transparent" onClick={() => setSel(sel === i ? null : i)} onMouseEnter={() => setSel(i)}>
                <title>
                  {dayLabel(d.date)}: {fmt(d.value)}
                </title>
              </rect>
            </g>
          )
        })}
        {target !== null && (
          <>
            <line x1={0} x2={W} y1={y(target)} y2={y(target)} className="target" />
            <text x={W} y={y(target) - 4} textAnchor="end" className="target-label">
              target {fmt(target)}
            </text>
          </>
        )}
        {data.map((d, i) =>
          i % every === 0 || i === data.length - 1 ? (
            <text key={d.date} x={i * slot + slot / 2} y={H - 4} textAnchor="middle" className="tick">
              {dayLabel(d.date)}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="small">
        {sel !== null && data[sel] ? (
          <>
            <strong>{dayLabel(data[sel].date)}</strong>: {data[sel].value === null ? 'nothing logged' : fmt(data[sel].value!)}
          </>
        ) : (
          <span className="muted">Tap a bar for the exact number.</span>
        )}
      </figcaption>
    </figure>
  )
}
