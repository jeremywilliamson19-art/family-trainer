import { useMember } from '../lib/session'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function Home() {
  const member = useMember()
  return (
    <div className="screen">
      <h1>
        {greeting()}, {member.display_name}
      </h1>
      <section className="card">
        <h2>Today</h2>
        <p className="muted">
          {member.role === 'child'
            ? 'Protein tracking and your training plan show up here soon.'
            : 'Food logging, macros and workouts show up here in the next update.'}
        </p>
      </section>
    </div>
  )
}
