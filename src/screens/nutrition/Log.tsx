import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MEAL_LABEL, addDays, localDate, mealName, mealTypeForTime, signature, suggestedMeals, sumTotals } from '../../lib/nutrition'
import { mutate, newId, useNutrition } from '../../lib/nutritionStore'
import { useMember } from '../../lib/session'
import { MEAL_TYPES, type Meal, type MealItem, type MealType } from '../../lib/types'

/** A repeat meal awaiting its one confirm tap, and where "change it" should go. */
interface Pending {
  items: MealItem[]
  editUrl: string
}

/** Log screen: two-tap repeat meals up top, then new / copy / history. */
export function Log() {
  const member = useMember()
  const showMacros = member.role !== 'child'
  const nav = useNavigate()
  const { meals, favorites } = useNutrition()
  const [type, setType] = useState<MealType>(mealTypeForTime())
  const [confirming, setConfirming] = useState<Pending | null>(null)

  const today = localDate()
  const suggestions = useMemo(() => suggestedMeals(meals, type), [meals, type])
  const favs = favorites.filter((f) => f.meal_type === type && !suggestions.some((s) => s.signature === signature(f.items)))
  const yesterday = meals.filter((m) => m.date === addDays(today, -1) && m.meal_type === type)

  const logNow = (items: Meal['items']) => {
    mutate({
      type: 'saveMeal',
      meal: { id: newId(), member_id: member.id, date: today, meal_type: type, items, logged_at: new Date().toISOString() },
    })
    nav('/', { replace: true })
  }

  if (confirming) {
    const t = sumTotals(confirming.items)
    return (
      <div className="screen">
        <h1>Log {MEAL_LABEL[type].toLowerCase()}?</h1>
        <section className="card">
          <ul className="list">
            {confirming.items.map((i, n) => (
              <li key={n} className="row">
                <span>{i.food.name}</span>
                <span className="muted">
                  {i.servings === 1 ? '' : `${i.servings} × `}
                  {i.food.serving_label}
                </span>
              </li>
            ))}
          </ul>
          <p>
            <strong>{Math.round(t.protein)} g protein</strong>
            {showMacros && <span className="muted"> · {Math.round(t.kcal)} cal</span>}
          </p>
        </section>
        <button className="btn" onClick={() => logNow(confirming.items)}>
          Log it
        </button>
        <button className="btn secondary" onClick={() => nav(confirming.editUrl)}>
          Change something first
        </button>
        <button className="btn link" onClick={() => setConfirming(null)}>
          Back
        </button>
      </div>
    )
  }

  const history = [1, 2, 3, 4, 5, 6, 7].map((n) => addDays(today, -n)).map((d) => [d, meals.filter((m) => m.date === d)] as const)

  return (
    <div className="screen">
      <h1>Log food</h1>
      <div className="segmented">
        {MEAL_TYPES.map((t) => (
          <button key={t} type="button" className={type === t ? 'on' : ''} onClick={() => setType(t)}>
            {MEAL_LABEL[t]}
          </button>
        ))}
      </div>

      {(suggestions.length > 0 || favs.length > 0) && (
        <section className="card">
          <h2>Your usual {MEAL_LABEL[type].toLowerCase()}</h2>
          <ul className="list">
            {suggestions.map((s) => (
              <li key={s.signature}>
                <button className="row food-row" onClick={() => setConfirming({ items: s.items, editUrl: `/meal/new?copy=${s.last.id}&type=${type}` })}>
                  <span>
                    {mealName(s.items)}
                    <small className="muted block">{s.count > 1 ? `logged ${s.count}×` : 'last time'}</small>
                  </span>
                  <span className="nums">
                    <strong>{Math.round(sumTotals(s.items).protein)} g</strong>
                  </span>
                </button>
              </li>
            ))}
            {favs.slice(0, 3).map((f) => (
              <li key={f.id}>
                <button className="row food-row" onClick={() => setConfirming({ items: f.items, editUrl: `/meal/new?fav=${f.id}&type=${type}` })}>
                  <span>
                    ⭐ {f.name}
                    <small className="muted block">{mealName(f.items)}</small>
                  </span>
                  <span className="nums">
                    <strong>{Math.round(sumTotals(f.items).protein)} g</strong>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link to={`/meal/new?type=${type}`} className="btn">
        + New {MEAL_LABEL[type].toLowerCase()}
      </Link>
      {yesterday.length > 0 && (
        <Link to={`/meal/new?copy=${yesterday[0].id}&type=${type}`} className="btn secondary">
          Copy yesterday’s {MEAL_LABEL[type].toLowerCase()}
        </Link>
      )}

      <section className="card">
        <h2>Past week</h2>
        {history.every(([, ms]) => !ms.length) && <p className="muted small">Meals you log show up here so you can copy them.</p>}
        {history.map(([d, ms]) =>
          ms.length ? (
            <div key={d}>
              <h3>{new Date(`${d}T12:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
              <ul className="list">
                {ms.map((m) => (
                  <li key={m.id} className="row">
                    <Link to={`/meal/${m.id}`} className="link-row grow">
                      <small className="muted block">{MEAL_LABEL[m.meal_type]}</small>
                      {mealName(m.items)}
                    </Link>
                    <Link to={`/meal/new?copy=${m.id}&type=${m.meal_type}`} className="btn small secondary">
                      Copy
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </section>
    </div>
  )
}

