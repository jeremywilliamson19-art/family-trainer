import { useMemo, useState } from 'react'
import { availableAt, homeEquipment, MUSCLES, type Exercise } from '../../lib/exercises'

/** Library filtered by location and the member's home equipment. */
export function ExercisePicker({
  location,
  equipment,
  youthOnly,
  onPick,
  onClose,
}: {
  location: 'gym' | 'home'
  equipment: string[]
  youthOnly: boolean
  onPick: (e: Exercise) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<string>('')
  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return availableAt(location, homeEquipment(equipment), youthOnly).filter(
      (e) => (!muscle || e.primary.includes(muscle as never)) && words.every((w) => e.name.toLowerCase().includes(w)),
    )
  }, [q, muscle, location, equipment, youthOnly])

  return (
    <div className="sheet">
      <div className="row sheet-head">
        <h2>Add exercise</h2>
        <button className="btn link" onClick={onClose}>
          Cancel
        </button>
      </div>
      <input type="search" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        <button className={`chip ${muscle === '' ? 'on' : ''}`} onClick={() => setMuscle('')}>
          All
        </button>
        {MUSCLES.map((m) => (
          <button key={m.id} className={`chip ${muscle === m.id ? 'on' : ''}`} onClick={() => setMuscle(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="muted small">
        {location === 'gym' ? 'Showing everything (gym).' : 'Showing what your home equipment allows. Edit equipment in Settings.'}
      </p>
      <ul className="list">
        {list.map((e) => (
          <li key={e.id}>
            <button className="row food-row" onClick={() => onPick(e)}>
              <span>
                {e.name}
                <small className="muted block">{[...e.primary, ...(e.secondary ?? [])].join(', ') || e.kind}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
