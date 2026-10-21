import { useState, type FormEvent } from 'react'

/** Editable list of short words, e.g. foods someone won't eat. */
export function ChipList({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('')
  const add = (e: FormEvent) => {
    e.preventDefault()
    const v = draft.trim().toLowerCase()
    if (v && !value.includes(v)) onChange([...value, v])
    setDraft('')
  }
  return (
    <div className="stack">
      <div className="chips">
        {value.map((v) => (
          <button key={v} type="button" className="chip" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
            {v} ✕
          </button>
        ))}
        {value.length === 0 && <span className="muted">None</span>}
      </div>
      <form onSubmit={add} className="row inline-form">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} />
        <button className="btn small">Add</button>
      </form>
    </div>
  )
}
