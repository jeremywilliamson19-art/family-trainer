import { useState } from 'react'
import { OZ_TO_G, fmtServings, withPortion } from '../../lib/nutrition'
import type { MealItem } from '../../lib/types'

const QUICK = [0.5, 1, 1.5, 2]

/**
 * Servings via quick buttons, or an exact amount in grams/ounces when the
 * food's serving weight is known. USDA foods can switch household portion.
 */
export function PortionPicker({ item, onChange }: { item: MealItem; onChange: (i: MealItem) => void }) {
  const { food, servings } = item
  const [mode, setMode] = useState<'servings' | 'g' | 'oz'>('servings')
  const grams = food.serving_g ? servings * food.serving_g : null
  const [draft, setDraft] = useState('')

  const setWeight = (v: string, unit: 'g' | 'oz') => {
    setDraft(v)
    const g = Number(v) * (unit === 'oz' ? OZ_TO_G : 1)
    if (food.serving_g && g > 0) onChange({ ...item, servings: g / food.serving_g })
  }

  return (
    <div className="portion">
      {food.portions && food.portions.length > 1 && mode === 'servings' && (
        <select
          value={food.serving_label}
          onChange={(e) => {
            const p = food.portions!.find(([l]) => l === e.target.value)
            if (p) onChange({ food: withPortion(food, p[0], p[1]), servings: 1 })
          }}
        >
          {food.portions.map(([l, g]) => (
            <option key={l} value={l}>
              {l} ({g} g)
            </option>
          ))}
        </select>
      )}

      <div className="row portion-row">
        {mode === 'servings' ? (
          <div className="segmented">
            {QUICK.map((q) => (
              <button type="button" key={q} className={servings === q ? 'on' : ''} onClick={() => onChange({ ...item, servings: q })}>
                {fmtServings(q)}
              </button>
            ))}
            {!QUICK.includes(Math.round(servings * 100) / 100) && <button className="on" type="button">{fmtServings(servings)}</button>}
          </div>
        ) : (
          <label className="weight-input">
            <input
              type="number"
              inputMode="decimal"
              autoFocus
              value={draft}
              placeholder={grams ? String(Math.round(mode === 'oz' ? grams / OZ_TO_G : grams)) : ''}
              onChange={(e) => setWeight(e.target.value, mode)}
            />
            {mode}
          </label>
        )}
        {food.serving_g && (
          <div className="segmented small">
            {(['servings', 'g', 'oz'] as const).map((m) => (
              <button
                type="button"
                key={m}
                className={mode === m ? 'on' : ''}
                onClick={() => {
                  setMode(m)
                  setDraft('')
                }}
              >
                {m === 'servings' ? '×' : m}
              </button>
            ))}
          </div>
        )}
      </div>
      <small className="muted">
        {mode === 'servings' ? `× ${food.serving_label}` : grams ? `= ${fmtServings(Math.round(servings * 100) / 100)} × ${food.serving_label}` : ''}
      </small>
    </div>
  )
}
