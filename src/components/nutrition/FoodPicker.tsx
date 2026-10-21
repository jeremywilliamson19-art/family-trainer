import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { normalizeBarcode } from '../../lib/barcode'
import { lookupBarcode, searchBranded, searchUsda } from '../../lib/foods'
import { mealName, recentFoods, sumTotals } from '../../lib/nutrition'
import { mutate, newId, useNutrition } from '../../lib/nutritionStore'
import type { Food, MealItem } from '../../lib/types'

// The barcode library is big; load it only when someone taps Scan.
const BarcodeScanner = lazy(() => import('./BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })))

type View = 'browse' | 'scan' | 'custom' | 'quick'

function FoodRow({ food, showMacros, onPick }: { food: Food; showMacros: boolean; onPick: () => void }) {
  return (
    <li>
      <button type="button" className="row food-row" onClick={onPick}>
        <span>
          {food.name}
          <small className="muted block">{[food.brand, food.serving_label].filter(Boolean).join(' · ')}</small>
        </span>
        <span className="nums">
          <strong>{Math.round(food.protein)} g</strong>
          {showMacros && food.kcal !== null && <small className="muted block">{Math.round(food.kcal)} cal</small>}
        </span>
      </button>
    </li>
  )
}

/** Full-screen sheet for adding foods to a meal. */
export function FoodPicker({ showMacros, onPick, onClose }: { showMacros: boolean; onPick: (items: MealItem[]) => void; onClose: () => void }) {
  const { meals, foods, favorites } = useNutrition()
  const [view, setView] = useState<View>('browse')
  const [tab, setTab] = useState<'recent' | 'favorites' | 'mine'>('recent')
  const [q, setQ] = useState('')
  const [usda, setUsda] = useState<Food[]>([])
  const [branded, setBranded] = useState<Food[] | null>(null)
  const [brandErr, setBrandErr] = useState<string | null>(null)
  const [scanNote, setScanNote] = useState<string | null>(null)
  const [prefillBarcode, setPrefillBarcode] = useState<string | null>(null)

  const recents = useMemo(() => recentFoods(meals), [meals])
  const pick = (food: Food) => onPick([{ food, servings: 1 }])

  // Local results: instant and offline.
  const query = q.trim().toLowerCase()
  const local = useMemo(() => {
    if (!query) return []
    const seen = new Set<string>()
    return [...recents, ...foods].filter((f) => {
      const hay = `${f.name} ${f.brand ?? ''}`.toLowerCase()
      if (seen.has(f.id) || !query.split(/\s+/).every((w) => hay.includes(w))) return false
      seen.add(f.id)
      return true
    })
  }, [query, recents, foods])

  useEffect(() => {
    setBranded(null)
    setBrandErr(null)
    if (query.length < 2) return setUsda([])
    let live = true
    searchUsda(query).then((r) => live && setUsda(r), () => {})
    // Brands are a network search; wait until typing pauses.
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      searchBranded(query, ctrl.signal).then(
        (r) => live && setBranded(r),
        (e) => live && e.name !== 'AbortError' && setBrandErr(navigator.onLine ? 'Brand search is slow or down right now.' : 'Brand search needs internet.'),
      )
    }, 700)
    return () => {
      live = false
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query])

  const onCode = useCallback(
    async (code: string) => {
      setScanNote('Looking up…')
      const known = foods.find((f) => f.barcode && normalizeBarcode(f.barcode) === code)
      if (known) return pick(known)
      try {
        const found = await lookupBarcode(code)
        if (found) {
          mutate({ type: 'saveFood', food: found }) // shared with the household from now on
          return pick(found)
        }
        setPrefillBarcode(code)
        setScanNote(null)
        setView('custom')
      } catch (e) {
        setScanNote((e as Error).message)
        setView('browse')
      }
    },
    [foods],
  )

  if (view === 'scan') {
    return (
      <div className="sheet">
        <h2>Scan a barcode</h2>
        {scanNote ? (
          <p className="muted">{scanNote}</p>
        ) : (
          <Suspense fallback={<p className="muted">Starting camera…</p>}>
            <BarcodeScanner onCode={onCode} onCancel={() => setView('browse')} />
          </Suspense>
        )}
      </div>
    )
  }
  if (view === 'custom') {
    return (
      <div className="sheet">
        <CustomFoodForm
          showMacros={showMacros}
          barcode={prefillBarcode}
          initialName={q}
          onSave={(food) => {
            mutate({ type: 'saveFood', food })
            pick(food)
          }}
          onCancel={() => setView('browse')}
        />
      </div>
    )
  }
  if (view === 'quick') {
    return (
      <div className="sheet">
        <QuickAddForm showMacros={showMacros} onSave={pick} onCancel={() => setView('browse')} />
      </div>
    )
  }

  const browse =
    tab === 'recent' ? recents : tab === 'mine' ? [...foods].sort((a, b) => a.name.localeCompare(b.name)) : []

  return (
    <div className="sheet">
      <div className="row sheet-head">
        <h2>Add food</h2>
        <button type="button" className="btn link" onClick={onClose}>
          Done
        </button>
      </div>
      <input type="search" placeholder="Search foods (e.g. chicken breast)" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="action-row">
        <button type="button" className="btn secondary small" onClick={() => { setScanNote(null); setView('scan') }}>
          📷 Scan
        </button>
        <button type="button" className="btn secondary small" onClick={() => setView('quick')}>
          ⚡ Quick add
        </button>
        <button type="button" className="btn secondary small" onClick={() => { setPrefillBarcode(null); setView('custom') }}>
          ✏️ Custom
        </button>
      </div>
      {scanNote && <p className="error">{scanNote}</p>}

      {query ? (
        <>
          {local.length > 0 && (
            <>
              <h3>Yours</h3>
              <ul className="list">{local.slice(0, 8).map((f) => <FoodRow key={f.id} food={f} showMacros={showMacros} onPick={() => pick(f)} />)}</ul>
            </>
          )}
          <h3>Common foods</h3>
          {usda.length ? (
            <ul className="list">{usda.map((f) => <FoodRow key={f.id} food={f} showMacros={showMacros} onPick={() => pick(f)} />)}</ul>
          ) : (
            <p className="muted small">No matches.</p>
          )}
          <h3>Brands</h3>
          {brandErr ? (
            <p className="muted small">{brandErr}</p>
          ) : branded === null ? (
            <p className="muted small">Searching…</p>
          ) : branded.length ? (
            <ul className="list">{branded.map((f) => <FoodRow key={f.id} food={f} showMacros={showMacros} onPick={() => pick(f)} />)}</ul>
          ) : (
            <p className="muted small">No brand matches. Try scanning the barcode, or add it as a custom food.</p>
          )}
        </>
      ) : (
        <>
          <div className="segmented tabs">
            <button type="button" className={tab === 'recent' ? 'on' : ''} onClick={() => setTab('recent')}>Recent</button>
            <button type="button" className={tab === 'favorites' ? 'on' : ''} onClick={() => setTab('favorites')}>Favorites</button>
            <button type="button" className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>Family foods</button>
          </div>
          {tab === 'favorites' ? (
            favorites.length ? (
              <ul className="list">
                {favorites.map((f) => (
                  <li key={f.id}>
                    <button type="button" className="row food-row" onClick={() => onPick(f.items.map((i) => ({ ...i })))}>
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
            ) : (
              <p className="muted small">Save a meal as a favorite and it shows up here.</p>
            )
          ) : browse.length ? (
            <ul className="list">{browse.map((f) => <FoodRow key={f.id} food={f} showMacros={showMacros} onPick={() => pick(f)} />)}</ul>
          ) : (
            <p className="muted small">{tab === 'recent' ? 'Foods you log show up here.' : 'Scanned and custom foods are shared with the family here.'}</p>
          )}
        </>
      )}
    </div>
  )
}

function CustomFoodForm({
  showMacros,
  barcode,
  initialName,
  onSave,
  onCancel,
}: {
  showMacros: boolean
  barcode: string | null
  initialName: string
  onSave: (f: Food) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initialName)
  const [brand, setBrand] = useState('')
  const [serving, setServing] = useState('1 serving')
  const [grams, setGrams] = useState('')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [fiber, setFiber] = useState('')
  const [sugar, setSugar] = useState('')
  const [satFat, setSatFat] = useState('')
  const [sodium, setSodium] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const n = (v: string) => (v === '' ? null : Number(v))
    onSave({
      id: barcode ? `off:${barcode}` : `c:${newId()}`,
      source: barcode ? 'off' : 'custom',
      name: name.trim(),
      brand: brand.trim() || null,
      barcode,
      serving_label: serving.trim() || '1 serving',
      serving_g: n(grams),
      kcal: showMacros ? n(kcal) : null,
      protein: Number(protein) || 0,
      carbs: showMacros ? n(carbs) : null,
      fat: showMacros ? n(fat) : null,
      fiber: showMacros ? n(fiber) : null,
      sugar: showMacros ? n(sugar) : null,
      sat_fat: showMacros ? n(satFat) : null,
      sodium_mg: showMacros ? n(sodium) : null,
    })
  }

  return (
    <form className="stack" onSubmit={submit}>
      <h2>{barcode ? 'New product' : 'Custom food'}</h2>
      {barcode && <p className="muted small">Barcode {barcode} isn’t in the database yet. Copy the label once and the whole family can scan it.</p>}
      <label className="field">
        <span>Name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Brand (optional)</span>
        <input value={brand} onChange={(e) => setBrand(e.target.value)} />
      </label>
      <div className="row inline-fields">
        <label className="field grow">
          <span>Serving size</span>
          <input value={serving} onChange={(e) => setServing(e.target.value)} placeholder="2 cookies" />
        </label>
        <label className="field">
          <span>Grams</span>
          <input type="number" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} />
        </label>
      </div>
      <div className="macro-inputs">
        {showMacros && (
          <label className="field">
            <span>Calories</span>
            <input required type="number" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} />
          </label>
        )}
        <label className="field">
          <span>Protein g</span>
          <input required type="number" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />
        </label>
        {showMacros && (
          <>
            <label className="field">
              <span>Carbs g</span>
              <input type="number" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
            </label>
            <label className="field">
              <span>Fat g</span>
              <input type="number" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
            </label>
          </>
        )}
      </div>
      {showMacros && (
        <details className="more-nutrients">
          <summary>More from the label (optional)</summary>
          <div className="macro-inputs">
            <label className="field">
              <span>Fiber g</span>
              <input type="number" inputMode="decimal" value={fiber} onChange={(e) => setFiber(e.target.value)} />
            </label>
            <label className="field">
              <span>Sugar g</span>
              <input type="number" inputMode="decimal" value={sugar} onChange={(e) => setSugar(e.target.value)} />
            </label>
            <label className="field">
              <span>Saturated fat g</span>
              <input type="number" inputMode="decimal" value={satFat} onChange={(e) => setSatFat(e.target.value)} />
            </label>
            <label className="field">
              <span>Sodium mg</span>
              <input type="number" inputMode="numeric" value={sodium} onChange={(e) => setSodium(e.target.value)} />
            </label>
          </div>
        </details>
      )}
      <button className="btn">Save &amp; add</button>
      <button type="button" className="btn secondary" onClick={onCancel}>
        Cancel
      </button>
    </form>
  )
}

/** Restaurant meals: calories and protein only (protein only for the son). */
function QuickAddForm({ showMacros, onSave, onCancel }: { showMacros: boolean; onSave: (f: Food) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave({
      id: `q:${newId()}`,
      source: 'quick',
      name: name.trim() || 'Quick add',
      serving_label: '1 meal',
      serving_g: null,
      kcal: showMacros ? Number(kcal) || 0 : null,
      protein: Number(protein) || 0,
      carbs: null,
      fat: null,
    })
  }
  return (
    <form className="stack" onSubmit={submit}>
      <h2>Quick add</h2>
      <label className="field">
        <span>What was it? (optional)</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chipotle bowl" />
      </label>
      <div className="macro-inputs">
        {showMacros && (
          <label className="field">
            <span>Calories</span>
            <input required type="number" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} />
          </label>
        )}
        <label className="field">
          <span>Protein g</span>
          <input required type="number" inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} />
        </label>
      </div>
      <button className="btn">Add</button>
      <button type="button" className="btn secondary" onClick={onCancel}>
        Cancel
      </button>
    </form>
  )
}
