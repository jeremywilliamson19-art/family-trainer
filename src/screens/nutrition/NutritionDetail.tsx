import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DailyBars } from '../../components/nutrition/DailyBars'
import { todayKey } from '../../components/nutrition/Dashboard'
import { nutrientGuides, type Targets } from '../../lib/macros'
import { MEAL_LABEL, addDays, dayTotals, fmtServings, itemTotals, localDate, sumTotals, type Totals } from '../../lib/nutrition'
import { useNutrition } from '../../lib/nutritionStore'
import { useMember } from '../../lib/session'
import { MEAL_TYPES, type ChildTargets, type Meal } from '../../lib/types'

const r = (n: number) => Math.round(n)
const dateKey = (date: string) => todayKey(new Date(`${date}T12:00`))
const prettyDate = (date: string) =>
  date === localDate() ? 'Today' : date === addDays(localDate(), -1) ? 'Yesterday' : new Date(`${date}T12:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

/** Totals, nutrients, per-meal breakdown (Day) and averages/charts (Trends). */
export function NutritionDetail() {
  const member = useMember()
  const isChild = member.role === 'child'
  const { targets, meals } = useNutrition()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'trends' ? 'trends' : 'day'

  return (
    <div className="screen">
      <h1>Nutrition</h1>
      <div className="segmented">
        <button className={view === 'day' ? 'on' : ''} onClick={() => setParams({}, { replace: true })}>
          Day
        </button>
        <button className={view === 'trends' ? 'on' : ''} onClick={() => setParams({ view: 'trends' }, { replace: true })}>
          Trends
        </button>
      </div>
      {view === 'day' ? (
        <DayView meals={meals} targets={targets ?? null} isChild={isChild} />
      ) : (
        <TrendsView meals={meals} targets={targets ?? null} isChild={isChild} />
      )}
    </div>
  )
}

function Bar({ value, target }: { value: number; target: number }) {
  return (
    <div className="bar">
      <div style={{ width: `${Math.min(100, (value / target) * 100)}%` }} />
    </div>
  )
}

function DayView({ meals, targets, isChild }: { meals: Meal[]; targets: Targets | ChildTargets | null; isChild: boolean }) {
  const [date, setDate] = useState(localDate())
  const dayMeals = meals.filter((m) => m.date === date)
  const t = dayTotals(dayMeals)
  const adult = !isChild && targets && 'calories' in targets ? (targets as Targets) : null
  const day = adult?.by_day[dateKey(date)]
  const proteinTarget = isChild ? ((targets as ChildTargets | null)?.protein_g ?? null) : (adult?.protein_g ?? null)

  return (
    <>
      <div className="row date-nav">
        <button className="btn small secondary" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>
          ‹
        </button>
        <strong>{prettyDate(date)}</strong>
        <button className="btn small secondary" aria-label="Next day" disabled={date >= localDate()} onClick={() => setDate(addDays(date, 1))}>
          ›
        </button>
      </div>

      <section className="card stack">
        <h2>{isChild ? 'Protein' : 'Macros'}</h2>
        <table className="macro-table">
          <thead>
            <tr>
              <th />
              <th>Eaten</th>
              <th>Target</th>
              <th>Left</th>
            </tr>
          </thead>
          <tbody>
            <MacroRow name="Protein" unit="g" eaten={t.protein} target={proteinTarget} hero />
            {!isChild && (
              <>
                <MacroRow name="Calories" unit="" eaten={t.kcal} target={day?.calories ?? null} />
                <MacroRow name="Carbs" unit="g" eaten={t.carbs} target={day?.carbs_g ?? null} />
                <MacroRow name="Fat" unit="g" eaten={t.fat} target={adult?.fat_g ?? null} />
              </>
            )}
          </tbody>
        </table>
        {!isChild && !adult && (
          <Link to="/targets" className="btn secondary">
            Set your targets
          </Link>
        )}
        {!isChild && t.kcal > 0 && (
          <p className="muted small">
            Calories from protein {r(((t.protein * 4) / t.kcal) * 100)}% · carbs {r(((t.carbs * 4) / t.kcal) * 100)}% · fat {r(((t.fat * 9) / t.kcal) * 100)}%
          </p>
        )}
      </section>

      {!isChild && <NutrientsCard totals={t} calories={day?.calories ?? 2000} />}

      <section className="card stack">
        <h2>Meals</h2>
        {dayMeals.length === 0 && <p className="muted small">Nothing logged{date === localDate() ? ' yet' : ''}.</p>}
        {MEAL_TYPES.flatMap((type) =>
          dayMeals
            .filter((m) => m.meal_type === type)
            .map((m) => {
              const mt = sumTotals(m.items)
              return (
                <div key={m.id} className="meal-breakdown">
                  <Link to={`/meal/${m.id}`} className="row link-row">
                    <strong>{MEAL_LABEL[type]}</strong>
                    <span className="small">
                      {r(mt.protein)} g protein{!isChild && ` · ${r(mt.kcal)} cal · ${r(mt.carbs)} C · ${r(mt.fat)} F`} ›
                    </span>
                  </Link>
                  <ul className="item-breakdown">
                    {m.items.map((it, i) => {
                      const x = itemTotals(it)
                      return (
                        <li key={i}>
                          <span>
                            {it.food.name}
                            <small className="muted block">
                              {it.servings === 1 ? '' : `${fmtServings(it.servings)} × `}
                              {it.food.serving_label}
                            </small>
                          </span>
                          <span className="nums small">
                            {r(x.protein)} g P
                            {!isChild && (
                              <small className="muted block">
                                {r(x.kcal)} cal · {r(x.carbs)} C · {r(x.fat)} F
                              </small>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            }),
        )}
      </section>
    </>
  )
}

function MacroRow({ name, unit, eaten, target, hero }: { name: string; unit: string; eaten: number; target: number | null; hero?: boolean }) {
  const left = target === null ? null : target - r(eaten)
  return (
    <>
      <tr className={hero ? 'hero' : ''}>
        <th>{name}</th>
        <td>
          {r(eaten).toLocaleString()}
          {unit}
        </td>
        <td className="muted">{target === null ? '–' : `${target.toLocaleString()}${unit}`}</td>
        <td className={left !== null && left < 0 ? 'warn-text' : ''}>
          {left === null ? '–' : left >= 0 ? `${left.toLocaleString()}${unit}` : `${(-left).toLocaleString()}${unit} over`}
        </td>
      </tr>
      {target !== null && (
        <tr className="bar-row">
          <td colSpan={4}>
            <Bar value={eaten} target={target} />
          </td>
        </tr>
      )}
    </>
  )
}

function NutrientsCard({ totals: t, calories }: { totals: Totals; calories: number }) {
  const g = nutrientGuides(calories)
  const rows = [
    { name: 'Fiber', v: t.fiber, unit: 'g', guide: `aim for ${g.fiber_min_g}+ g`, ok: t.fiber >= g.fiber_min_g, kind: 'min' as const, target: g.fiber_min_g, missing: t.missing.fiber },
    { name: 'Sugar', v: t.sugar, unit: 'g', guide: 'total, incl. fruit & milk', ok: true, kind: 'info' as const, target: 0, missing: t.missing.sugar },
    { name: 'Saturated fat', v: t.sat_fat, unit: 'g', guide: `under ${g.sat_fat_max_g} g`, ok: t.sat_fat <= g.sat_fat_max_g, kind: 'max' as const, target: g.sat_fat_max_g, missing: t.missing.sat_fat },
    { name: 'Sodium', v: t.sodium_mg, unit: 'mg', guide: `under ${g.sodium_max_mg.toLocaleString()} mg`, ok: t.sodium_mg <= g.sodium_max_mg, kind: 'max' as const, target: g.sodium_max_mg, missing: t.missing.sodium_mg },
  ]
  const missing = Math.max(...rows.map((x) => x.missing))
  return (
    <section className="card stack">
      <h2>Nutrients</h2>
      <ul className="nutrient-list">
        {rows.map((x) => (
          <li key={x.name}>
            <div className="row">
              <span>
                {x.name}
                <small className="muted block">{x.guide}</small>
              </span>
              <span className="nums">
                <strong>
                  {r(x.v).toLocaleString()} {x.unit}
                </strong>
                {x.kind === 'max' && !x.ok && <small className="warn-text block">over</small>}
                {x.kind === 'min' && x.ok && <small className="ok block">✓</small>}
              </span>
            </div>
            {x.kind !== 'info' && <Bar value={x.v} target={x.target} />}
          </li>
        ))}
      </ul>
      {missing > 0 && (
        <p className="muted small">
          {missing} food{missing === 1 ? ' has' : 's have'} no data for some of these (quick adds and some custom foods), so the real totals may be a bit
          higher.
        </p>
      )}
    </section>
  )
}

function TrendsView({ meals, targets, isChild }: { meals: Meal[]; targets: Targets | ChildTargets | null; isChild: boolean }) {
  const [range, setRange] = useState<7 | 30>(7)
  const [showTable, setShowTable] = useState(false)
  const today = localDate()
  const days = useMemo(() => Array.from({ length: range }, (_, i) => addDays(today, i - range + 1)), [range, today])
  const perDay = useMemo(
    () =>
      days.map((d) => {
        const dm = meals.filter((m) => m.date === d)
        return { date: d, logged: dm.length > 0, t: dayTotals(dm) }
      }),
    [days, meals],
  )
  const logged = perDay.filter((d) => d.logged)
  const avg = (f: (t: Totals) => number) => (logged.length ? logged.reduce((n, d) => n + f(d.t), 0) / logged.length : 0)
  const adult = !isChild && targets && 'calories' in targets ? (targets as Targets) : null
  const proteinTarget = isChild ? ((targets as ChildTargets | null)?.protein_g ?? null) : (adult?.protein_g ?? null)
  const hit = proteinTarget === null ? 0 : logged.filter((d) => d.t.protein >= proteinTarget).length
  const missedGap = proteinTarget === null ? 0 : avgOf(logged.filter((d) => d.t.protein < proteinTarget).map((d) => proteinTarget - d.t.protein))

  return (
    <>
      <div className="segmented small">
        <button className={range === 7 ? 'on' : ''} onClick={() => setRange(7)}>
          7 days
        </button>
        <button className={range === 30 ? 'on' : ''} onClick={() => setRange(30)}>
          30 days
        </button>
      </div>

      <section className="card stack">
        <h2>Averages</h2>
        <p className="muted small">
          Over the {logged.length} day{logged.length === 1 ? '' : 's'} you logged food in the last {range}.
        </p>
        {logged.length === 0 ? (
          <p className="muted">Log some meals and your averages show up here.</p>
        ) : (
          <>
            <div className="stat-grid">
              <div className="stat hero">
                <strong>
                  {hit} of {logged.length}
                </strong>
                <span>days protein target hit</span>
                {missedGap > 0 && <small className="muted">missed days: {r(missedGap)} g short on average</small>}
              </div>
              <div className="stat">
                <strong>{r(avg((t) => t.protein))} g</strong>
                <span>protein / day{proteinTarget !== null && ` (target ${proteinTarget})`}</span>
              </div>
              {!isChild && (
                <>
                  <div className="stat">
                    <strong>{r(avg((t) => t.kcal)).toLocaleString()}</strong>
                    <span>calories / day{adult && ` (target ${adult.calories.toLocaleString()})`}</span>
                  </div>
                  <div className="stat">
                    <strong>{r(avg((t) => t.carbs))} g</strong>
                    <span>carbs / day{adult && ` (target ${adult.carbs_g})`}</span>
                  </div>
                  <div className="stat">
                    <strong>{r(avg((t) => t.fat))} g</strong>
                    <span>fat / day{adult && ` (target ${adult.fat_g})`}</span>
                  </div>
                  <div className="stat">
                    <strong>{r(avg((t) => t.fiber))} g</strong>
                    <span>fiber / day</span>
                  </div>
                  <div className="stat">
                    <strong>{r(avg((t) => t.sodium_mg)).toLocaleString()} mg</strong>
                    <span>sodium / day</span>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </section>

      <section className="card stack">
        <h2>Protein per day</h2>
        <DailyBars data={perDay.map((d) => ({ date: d.date, value: d.logged ? d.t.protein : null }))} target={proteinTarget} unit="g" label="Protein" />
      </section>

      {!isChild && (
        <section className="card stack">
          <h2>Calories per day</h2>
          <DailyBars data={perDay.map((d) => ({ date: d.date, value: d.logged ? d.t.kcal : null }))} target={adult?.calories ?? null} unit="cal" label="Calories" />
        </section>
      )}

      <button className="btn link" onClick={() => setShowTable(!showTable)}>
        {showTable ? 'Hide' : 'Show'} the numbers as a table
      </button>
      {showTable && (
        <section className="card">
          <table className="trend-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Protein</th>
                {!isChild && (
                  <>
                    <th>Cal</th>
                    <th>Carbs</th>
                    <th>Fat</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {[...perDay].reverse().map((d) => (
                <tr key={d.date}>
                  <td>{new Date(`${d.date}T12:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })}</td>
                  {d.logged ? (
                    <>
                      <td>{r(d.t.protein)} g</td>
                      {!isChild && (
                        <>
                          <td>{r(d.t.kcal).toLocaleString()}</td>
                          <td>{r(d.t.carbs)} g</td>
                          <td>{r(d.t.fat)} g</td>
                        </>
                      )}
                    </>
                  ) : (
                    <td colSpan={isChild ? 1 : 4} className="muted">
                      not logged
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}

function avgOf(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}
