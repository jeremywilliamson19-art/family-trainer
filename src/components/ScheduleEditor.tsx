import { DAYS, type Day, type DayType } from '../lib/types'

const LABELS: Record<Day, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
const ORDER: DayType[] = ['rest', 'gym', 'home']

/** Tap a day to cycle rest → gym → home. */
export function ScheduleEditor({
  value,
  onChange,
  types = ORDER,
}: {
  value: Partial<Record<Day, DayType>>
  onChange: (v: Partial<Record<Day, DayType>>) => void
  types?: DayType[]
}) {
  return (
    <div className="schedule">
      {DAYS.map((d) => {
        const t = value[d] ?? 'rest'
        const next = types[(types.indexOf(t) + 1) % types.length]
        return (
          <button key={d} type="button" className={`day ${t}`} onClick={() => onChange({ ...value, [d]: next })}>
            <span>{LABELS[d]}</span>
            <small>{t}</small>
          </button>
        )
      })}
    </div>
  )
}
