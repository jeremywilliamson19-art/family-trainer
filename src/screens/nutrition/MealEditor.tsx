import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FoodPicker } from '../../components/nutrition/FoodPicker'
import { PortionPicker } from '../../components/nutrition/PortionPicker'
import { MEAL_LABEL, localDate, mealName, mealTypeForTime, signature, sumTotals } from '../../lib/nutrition'
import { mutate, newId, useNutrition } from '../../lib/nutritionStore'
import { useMember } from '../../lib/session'
import { MEAL_TYPES, type MealItem, type MealType } from '../../lib/types'

/** New meal (/meal/new?type=&copy=&fav=) or edit an existing one (/meal/:id). */
export function MealEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const member = useMember()
  const showMacros = member.role !== 'child'
  const { meals, favorites } = useNutrition()

  const existing = id ? meals.find((m) => m.id === id) : undefined
  const source = useMemo(() => {
    const copy = params.get('copy')
    if (copy) return meals.find((m) => m.id === copy)?.items
    const fav = params.get('fav')
    if (fav) return favorites.find((f) => f.id === fav)?.items
    return undefined
    // Only on first render: later syncs mustn't reset the editor.
  }, [])

  const [type, setType] = useState<MealType>(existing?.meal_type ?? (params.get('type') as MealType) ?? mealTypeForTime())
  const [items, setItems] = useState<MealItem[]>(existing?.items ?? source ?? [])
  const [picking, setPicking] = useState(!existing && !source)
  const [askFavorite, setAskFavorite] = useState(false)
  const [favName, setFavName] = useState('')

  if (id && !existing) {
    return (
      <div className="screen">
        <p className="muted">That meal isn’t here. It may have been deleted.</p>
      </div>
    )
  }

  const totals = sumTotals(items)
  const done = () => nav('/', { replace: true })

  const save = () => {
    if (!items.length) return
    const sig = signature(items)
    const isNewCombo =
      !existing && items.length > 1 && !meals.some((m) => signature(m.items) === sig) && !favorites.some((f) => signature(f.items) === sig)
    mutate({
      type: 'saveMeal',
      meal: {
        id: existing?.id ?? newId(),
        member_id: member.id,
        date: existing?.date ?? localDate(),
        meal_type: type,
        items,
        logged_at: existing?.logged_at ?? new Date().toISOString(),
      },
    })
    if (isNewCombo) {
      setFavName(mealName(items))
      setAskFavorite(true)
    } else done()
  }

  if (askFavorite) {
    return (
      <div className="screen">
        <h1>Logged ✓</h1>
        <section className="card stack">
          <h2>Save as favorite?</h2>
          <p className="muted">Favorites log in two taps next time.</p>
          <input value={favName} onChange={(e) => setFavName(e.target.value)} aria-label="Favorite name" />
          <button
            className="btn"
            onClick={() => {
              mutate({ type: 'saveFavorite', favorite: { id: newId(), member_id: member.id, name: favName.trim() || mealName(items), meal_type: type, items } })
              done()
            }}
          >
            Save favorite
          </button>
          <button className="btn secondary" onClick={done}>
            No thanks
          </button>
        </section>
      </div>
    )
  }

  if (picking) {
    return (
      <FoodPicker
        showMacros={showMacros}
        onPick={(added) => {
          setItems((cur) => [...cur, ...added])
          setPicking(false)
        }}
        onClose={() => (items.length ? setPicking(false) : nav(-1))}
      />
    )
  }

  return (
    <div className="screen with-footer">
      <div className="segmented">
        {MEAL_TYPES.map((t) => (
          <button key={t} type="button" className={type === t ? 'on' : ''} onClick={() => setType(t)}>
            {MEAL_LABEL[t]}
          </button>
        ))}
      </div>

      <ul className="list items">
        {items.map((it, i) => (
          <li key={`${it.food.id}-${i}`} className="item card">
            <div className="row">
              <span>
                <strong>{it.food.name}</strong>
                {it.food.brand && <small className="muted block">{it.food.brand}</small>}
              </span>
              <button className="btn link small" aria-label={`Remove ${it.food.name}`} onClick={() => setItems(items.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
            <PortionPicker item={it} onChange={(next) => setItems(items.map((x, j) => (j === i ? next : x)))} />
          </li>
        ))}
      </ul>

      <button className="btn secondary" onClick={() => setPicking(true)}>
        + Add food
      </button>

      {existing && (
        <>
          <button
            className="btn secondary"
            onClick={() => nav(`/meal/new?copy=${existing.id}&type=${existing.meal_type}`)}
          >
            Copy to today
          </button>
          <button
            className="btn secondary danger"
            onClick={() => {
              if (confirm('Delete this meal?')) {
                mutate({ type: 'deleteMeal', id: existing.id })
                done()
              }
            }}
          >
            Delete meal
          </button>
        </>
      )}

      <div className="footer-bar">
        <div className="totals">
          <strong>{Math.round(totals.protein)} g protein</strong>
          {showMacros && (
            <small className="muted">
              {Math.round(totals.kcal)} cal · {Math.round(totals.carbs)} C · {Math.round(totals.fat)} F
            </small>
          )}
        </div>
        <button className="btn" disabled={!items.length} onClick={save}>
          {existing ? 'Save' : 'Log meal'}
        </button>
      </div>
    </div>
  )
}
