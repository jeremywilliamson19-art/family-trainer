const PRESETS = [
  { id: 'pullup_bar', label: 'Pull-up bar' },
  { id: 'bands', label: 'Resistance bands' },
  { id: 'bench', label: 'Bench' },
  { id: 'kettlebell', label: 'Kettlebell' },
]

/** Home equipment list. Dumbbells are stored as "dumbbells:MIN-MAX". */
export function Equipment({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const db = value.find((v) => v.startsWith('dumbbells'))
  const [lo, hi] = db?.split(':')[1]?.split('-').map(Number) ?? [5, 50]
  const others = value.filter((v) => !v.startsWith('dumbbells'))

  const setDumbbells = (on: boolean, min = lo, max = hi) =>
    onChange([...others, ...(on ? [`dumbbells:${min}-${max}`] : [])])

  return (
    <div className="stack">
      <label className="row toggle">
        <span>Dumbbells</span>
        <input type="checkbox" role="switch" checked={!!db} onChange={(e) => setDumbbells(e.target.checked)} />
      </label>
      {db && (
        <div className="row inline-fields">
          <label>
            From <input type="number" inputMode="numeric" value={lo} onChange={(e) => setDumbbells(true, Number(e.target.value), hi)} /> lb
          </label>
          <label>
            to <input type="number" inputMode="numeric" value={hi} onChange={(e) => setDumbbells(true, lo, Number(e.target.value))} /> lb
          </label>
        </div>
      )}
      {PRESETS.map((p) => (
        <label key={p.id} className="row toggle">
          <span>{p.label}</span>
          <input
            type="checkbox"
            role="switch"
            checked={value.includes(p.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, p.id] : value.filter((v) => v !== p.id))}
          />
        </label>
      ))}
    </div>
  )
}
