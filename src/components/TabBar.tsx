import { NavLink } from 'react-router-dom'

export function TabBar() {
  return (
    <nav className="tabbar">
      <NavLink to="/" end>
        <span aria-hidden>🏠</span>Today
      </NavLink>
      <NavLink to="/log">
        <span aria-hidden>🍽️</span>Log
      </NavLink>
      <NavLink to="/train">
        <span aria-hidden>🏋️</span>Train
      </NavLink>
      <NavLink to="/progress">
        <span aria-hidden>📈</span>Progress
      </NavLink>
      <NavLink to="/settings">
        <span aria-hidden>⚙️</span>Settings
      </NavLink>
    </nav>
  )
}
