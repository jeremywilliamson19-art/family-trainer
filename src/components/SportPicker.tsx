import { SPORTS } from '../lib/sports'

export function SportPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="chips">
      {SPORTS.map((s) => {
        const on = value.includes(s.id)
        return (
          <button
            key={s.id}
            type="button"
            className={`chip ${on ? 'on' : ''}`}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== s.id) : [...value, s.id])}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
