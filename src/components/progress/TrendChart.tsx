import { useState } from 'react'

export interface ChartPoint {
  date: string
  value: number
  /** Optional smoothed value drawn as the line (dots show the raw values). */
  trend?: number
}

/**
 * Values over time on a real date axis. With `trend`, raw entries are dots
 * and the trend is the line (legend shown); otherwise one line with dots.
 * Tap or hover near a point for its value.
 */
export function TrendChart({ points, unit, goal, decimals = 1, label }: { points: ChartPoint[]; unit: string; goal?: number | null; decimals?: number; label: string }) {
  const [sel, setSel] = useState<number | null>(null)
  if (points.length < 2) return <p className="muted small">The chart appears after two entries.</p>
  const W = 320
  const H = 150
  const pad = { l: 34, r: 8, t: 12, b: 20 }
  const t = (d: string) => new Date(`${d}T12:00`).getTime()
  const t0 = t(points[0].date)
  const t1 = t(points[points.length - 1].date)
  // Scale to the data: a far-off goal would flatten the real trend. The goal
  // line is drawn only when it falls inside the plotted range.
  const vals = [...points.map((p) => p.value), ...points.map((p) => p.trend ?? p.value)]
  let lo = Math.min(...vals)
  let hi = Math.max(...vals)
  const span = hi - lo || Math.abs(hi) * 0.05 || 1
  lo -= span * 0.12
  hi += span * 0.12
  const x = (d: string) => pad.l + ((t(d) - t0) / (t1 - t0 || 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b)
  const hasTrend = points.some((p) => p.trend !== undefined)
  const showGoal = !!goal && goal >= lo && goal <= hi
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.trend ?? p.value).toFixed(1)}`).join(' ')
  const fmt = (v: number) => `${v.toFixed(decimals)} ${unit}`.trim()
  const short = (d: string) => new Date(`${d}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const ticks = [hi - (hi - lo) * 0.12, (hi + lo) / 2, lo + (hi - lo) * 0.12]

  return (
    <figure className="trend-chart">
      {hasTrend && (
        <div className="legend small">
          <span>
            <i className="dot" /> entries
          </span>
          <span>
            <i className="ln" /> 7-day trend
          </span>
          {showGoal ? (
            <span>
              <i className="goal" /> goal
            </span>
          ) : null}
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${label} over time`}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          let best = 0
          points.forEach((p, i) => {
            if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i
          })
          setSel(best)
        }}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={pad.l - 4} y={y(v) + 3} textAnchor="end" className="tick">
              {v.toFixed(decimals === 0 ? 0 : v > 100 ? 0 : 1)}
            </text>
          </g>
        ))}
        {showGoal ? <line x1={pad.l} x2={W - pad.r} y1={y(goal!)} y2={y(goal!)} className="goal-line" /> : null}
        <path d={line} className="series" />
        {points.map((p, i) => (
          <circle key={p.date + i} cx={x(p.date)} cy={y(p.value)} r={sel === i ? 5 : hasTrend ? 3 : 4} className={`pt ${hasTrend ? 'raw' : ''} ${sel === i ? 'sel' : ''}`} />
        ))}
        <text x={pad.l} y={H - 4} className="tick">
          {short(points[0].date)}
        </text>
        <text x={W - pad.r} y={H - 4} textAnchor="end" className="tick">
          {short(points[points.length - 1].date)}
        </text>
      </svg>
      <figcaption className="small">
        {sel !== null ? (
          <>
            <strong>{short(points[sel].date)}</strong>: {fmt(points[sel].value)}
            {points[sel].trend !== undefined && <span className="muted"> · trend {fmt(points[sel].trend!)}</span>}
          </>
        ) : (
          <span className="muted">Touch the chart for exact numbers.</span>
        )}
      </figcaption>
    </figure>
  )
}
