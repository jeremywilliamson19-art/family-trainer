import { Link } from 'react-router-dom'
import type { Targets } from '../../lib/macros'
import type { Totals } from '../../lib/nutrition'
import type { Day } from '../../lib/types'

const DAY_KEYS: Day[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
export const todayKey = (d = new Date()): Day => DAY_KEYS[d.getDay()]

/** Protein first and biggest, then calories, then a small carbs/fat bar. */
export function AdultDashboard({ targets, eaten }: { targets: Targets; eaten: Totals }) {
  const day = targets.by_day[todayKey()]
  // Round eaten first so "eaten" and "to go" always add up to the target.
  const proteinEaten = Math.round(eaten.protein)
  const proteinLeft = targets.protein_g - proteinEaten
  const kcalLeft = Math.round(day.calories - eaten.kcal)
  const pct = (a: number, b: number) => `${Math.min(100, Math.max(0, (a / b) * 100))}%`

  return (
    <section className="card dashboard">
      <div className="protein-hero">
        <span className="big">{Math.abs(proteinLeft)}</span>
        <span className="unit">g protein {proteinLeft >= 0 ? 'to go' : 'over'}</span>
        <div className="bar thick">
          <div style={{ width: pct(eaten.protein, targets.protein_g) }} />
        </div>
        <small className="muted">
          {proteinEaten} of {targets.protein_g} g
        </small>
      </div>

      <div className="row kcal-row">
        <span>
          <strong>{Math.abs(kcalLeft).toLocaleString()}</strong> {kcalLeft >= 0 ? 'calories left' : 'calories over'}
        </span>
        <span className="muted small">
          {Math.round(eaten.kcal).toLocaleString()} / {day.calories.toLocaleString()}
          {targets.training_adjust && (day.training ? ' · training day' : ' · rest day')}
        </span>
      </div>

      <div className="mini-bars">
        <label>
          <span>Carbs</span>
          <div className="bar">
            <div style={{ width: pct(eaten.carbs, day.carbs_g) }} />
          </div>
          <small>
            {Math.round(eaten.carbs)}/{day.carbs_g} g
          </small>
        </label>
        <label>
          <span>Fat</span>
          <div className="bar">
            <div style={{ width: pct(eaten.fat, targets.fat_g) }} />
          </div>
          <small>
            {Math.round(eaten.fat)}/{targets.fat_g} g
          </small>
        </label>
      </div>

      <Link to="/targets" className="row targets-line">
        <span className="muted small">
          Daily targets{targets.custom ? ' (your own)' : ''}: <strong>{targets.protein_g} g protein</strong> · {day.calories.toLocaleString()} cal · {day.carbs_g} g carbs ·{' '}
          {targets.fat_g} g fat
        </span>
        <span className="link-text">Edit</span>
      </Link>
    </section>
  )
}

const FUEL_TIPS = [
  'Game day: eat a carb-heavy meal 2–3 hours before you play — pasta, rice, sandwiches, fruit.',
  'Have protein within an hour after lifting or practice — milk, eggs, chicken, Greek yogurt.',
  'Drink water all day, not just at practice. Pale yellow means you’re good.',
  'A banana or granola bar 30–60 minutes before practice gives quick energy.',
  'Spread protein across the day: some at breakfast, lunch, dinner and a snack.',
  'Chocolate milk after a hard workout is a great recovery drink.',
  'Big game tomorrow? Eat a normal, carb-rich dinner tonight and get to bed early.',
]

/** The son's view: protein only, plus a fueling tip. Never calories. */
export function ChildDashboard({ target, eaten: raw }: { target: number; eaten: number }) {
  const eaten = Math.round(raw)
  const tip = FUEL_TIPS[Math.floor(Date.now() / 86_400_000) % FUEL_TIPS.length]
  const done = eaten >= target
  return (
    <>
      <section className="card dashboard">
        <div className="protein-hero">
          <span className="unit">Protein</span>
          <span className="big">
            {eaten} <span className="of">/ {target} g</span>
          </span>
          <div className="bar thick">
            <div style={{ width: `${Math.min(100, (eaten / target) * 100)}%` }} />
          </div>
          <small className={done ? 'ok' : 'muted'}>{done ? 'You hit your protein today! 💪' : `${target - eaten} g to go`}</small>
        </div>
      </section>
      <section className="card tip">
        <strong>Fuel tip</strong>
        <p>{tip}</p>
      </section>
    </>
  )
}
