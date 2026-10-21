import { Link } from 'react-router-dom'
import { AdultDashboard, ChildDashboard } from '../components/nutrition/Dashboard'
import { MealList } from '../components/nutrition/MealList'
import { useSettings } from '../lib/useSettings'
import { dayTotals, localDate } from '../lib/nutrition'
import { useNutrition } from '../lib/nutritionStore'
import { useMember } from '../lib/session'
import type { Targets } from '../lib/macros'
import type { ChildTargets } from '../lib/types'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function Home() {
  const member = useMember()
  const settings = useSettings()
  const { targets, meals, outbox, syncing } = useNutrition()
  const isChild = member.role === 'child'
  const today = localDate()
  const todays = meals.filter((m) => m.date === today)
  const eaten = dayTotals(todays)

  if (settings && !settings.track_food && !isChild) {
    return (
      <div className="screen">
        <h1>
          {greeting()}, {member.display_name}
        </h1>
        <section className="card">
          <p className="muted">Food tracking is off. You can turn it on any time in Settings → What I track.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="screen">
      <h1>
        {greeting()}, {member.display_name}
      </h1>

      {targets === undefined ? (
        <p className="muted">{syncing ? 'Loading…' : 'Connect to the internet to load your plan.'}</p>
      ) : isChild ? (
        targets ? (
          <ChildDashboard target={(targets as ChildTargets).protein_g} eaten={eaten.protein} />
        ) : (
          <section className="card">
            <p className="muted">Your protein goal shows up once a parent finishes your setup.</p>
          </section>
        )
      ) : targets ? (
        <AdultDashboard targets={targets as Targets} eaten={eaten} />
      ) : (
        <section className="card stack">
          <h2>Set your targets</h2>
          <p className="muted">A few quick questions (age, height, weight, activity) and you’ll get daily calorie and protein targets.</p>
          <Link to="/targets" className="btn">
            Get started
          </Link>
        </section>
      )}

      <Link to="/log" className="btn">
        + Log food
      </Link>

      <section className="card">
        <h2>Today</h2>
        <MealList meals={todays} showMacros={!isChild} />
        {outbox.length > 0 && <p className="muted small">{outbox.length} change{outbox.length === 1 ? '' : 's'} waiting to sync</p>}
      </section>
    </div>
  )
}
