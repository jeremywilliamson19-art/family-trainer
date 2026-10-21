import { Link } from 'react-router-dom'
import { MEAL_LABEL, mealName, sumTotals } from '../../lib/nutrition'
import { MEAL_TYPES, type Meal } from '../../lib/types'

/** A day's meals grouped by type. Tapping a meal opens it for editing. */
export function MealList({ meals, showMacros }: { meals: Meal[]; showMacros: boolean }) {
  const groups = MEAL_TYPES.map((t) => [t, meals.filter((m) => m.meal_type === t)] as const).filter(([, ms]) => ms.length)
  if (!groups.length) return <p className="muted">Nothing logged yet today.</p>
  return (
    <ul className="list meal-list">
      {groups.flatMap(([type, ms]) =>
        ms.map((m) => {
          const t = sumTotals(m.items)
          return (
            <li key={m.id}>
              <Link to={`/meal/${m.id}`} className="row link-row">
                <span>
                  <small className="muted block">{MEAL_LABEL[type]}</small>
                  {mealName(m.items)}
                </span>
                <span className="nums">
                  <strong>{Math.round(t.protein)} g</strong>
                  {showMacros && <small className="muted block">{Math.round(t.kcal)} cal</small>}
                </span>
              </Link>
            </li>
          )
        }),
      )}
    </ul>
  )
}
