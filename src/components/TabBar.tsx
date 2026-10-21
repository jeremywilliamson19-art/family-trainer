import { NavLink } from 'react-router-dom'
import { useMember } from '../lib/session'

export function TabBar() {
  const member = useMember()
  return (
    <nav className="tabbar">
      <NavLink to="/" end>
        <span aria-hidden>🏠</span>Today
      </NavLink>
      {member.role === 'admin' && (
        <NavLink to="/admin">
          <span aria-hidden>👨‍👩‍👦</span>Family
        </NavLink>
      )}
      <NavLink to="/settings">
        <span aria-hidden>⚙️</span>Settings
      </NavLink>
    </nav>
  )
}
