import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon.jsx'
import { usePrefs } from '../lib/prefs.js'

const TABS = [
  { to: '/',            icon: 'home',     label: 'Inicio' },
  { to: '/movimientos', icon: 'list',     label: 'Movimientos' },
  null, // botón central "+"
  { to: '/pagos',       icon: 'calendar', label: 'Pagos' },
  { to: '/cuentas',     icon: 'wallet',   label: 'Cuentas' }
]

const TITULOS = {
  '/': 'Inicio',
  '/movimientos': 'Movimientos',
  '/pagos': 'Pagos',
  '/cuentas': 'Cuentas',
  '/recibo': 'Recibo',
  '/ajustes': 'Categorías',
  '/mas': 'Más'
}

export default function Layout({ children }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { prefs, setPrefs } = usePrefs()

  return (
    <div className="shell">
      <header className="topbar">
        <h1>{TITULOS[pathname] ?? 'Finanzas'}</h1>
        <div className="topbar-actions">
          <button
            className={'icon-btn' + (prefs.hide ? ' on' : '')}
            onClick={() => setPrefs({ ...prefs, hide: !prefs.hide })}
            aria-label={prefs.hide ? 'Mostrar cifras' : 'Ocultar cifras'}
            title={prefs.hide ? 'Mostrar cifras' : 'Ocultar cifras'}
          >
            <Icon name={prefs.hide ? 'eyeOff' : 'eye'} size={20} />
          </button>
          <Link
            to="/mas"
            className={'icon-btn' + (pathname === '/mas' ? ' on' : '')}
            aria-label="Más opciones"
          >
            <Icon name="more" size={22} stroke={2.6} />
          </Link>
        </div>
      </header>

      {children}

      <nav className="nav">
        <div className="nav-inner">
          {TABS.map((t, i) =>
            t ? (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                <Icon name={t.icon} />
                <span>{t.label}</span>
              </NavLink>
            ) : (
              <div key={i} className="fab-slot">
                <button
                  className="fab"
                  aria-label="Registrar movimiento"
                  onClick={() => navigate('/movimientos', { state: { nuevo: Date.now() } })}
                >
                  <Icon name="plus" size={26} stroke={2.4} />
                </button>
              </div>
            )
          )}
        </div>
      </nav>
    </div>
  )
}
