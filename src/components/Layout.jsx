import { NavLink, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

const TABS = [
  { to: '/',            ico: '🏠', label: 'Inicio' },
  { to: '/movimientos', ico: '💵', label: 'Movimientos' },
  { to: '/pagos',       ico: '📅', label: 'Pagos' },
  { to: '/cuentas',     ico: '💳', label: 'Cuentas' },
  { to: '/ajustes',     ico: '⚙️', label: 'Ajustes' }
]

export default function Layout({ children, session }) {
  const { pathname } = useLocation()
  const current = TABS.find(t => t.to === pathname)

  return (
    <div className="shell">
      <header className="topbar">
        <h1>{current ? current.label : 'Finanzas'}</h1>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 10px', fontSize: 13 }}
          onClick={() => supabase.auth.signOut()}
        >
          Salir
        </button>
      </header>

      {children}

      <nav className="nav">
        {TABS.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            <span className="ico">{t.ico}</span>
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
