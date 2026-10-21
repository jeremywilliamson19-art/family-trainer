import { Link } from 'react-router-dom'
import { exercise } from '../lib/exercises'

/** An exercise name that opens its form guide. */
export function ExerciseLink({ id, who, className }: { id: string; who?: string; className?: string }) {
  return (
    <Link to={`/exercise/${id}${who ? `?who=${who}` : ''}`} className={`ex-link ${className ?? ''}`} onClick={(e) => e.stopPropagation()}>
      {exercise(id).name}
    </Link>
  )
}
