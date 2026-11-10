import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { usePrefs } from '../lib/prefs.js'
import { useToast } from '../components/Toast.jsx'
import Icon from '../components/Icon.jsx'
import { PasswordForm } from './NewPassword.jsx'

export default function More({ session }) {
  const { prefs, setPrefs } = usePrefs()
  const toast = useToast()
  const [cambiarClave, setCambiarClave] = useState(false)

  return (
    <div className="page stack">
      <div className="list">
        <Link to="/recibo" className="list-item">
          <span className="avatar"><Icon name="receipt" size={20} /></span>
          <span className="grow">
            <span className="line-1">Recibo en blanco</span>
            <span className="line-2">Recibí, pagué, presté o guardo dinero</span>
          </span>
          <Icon name="chevron" size={18} className="faint" />
        </Link>
        <Link to="/ajustes" className="list-item">
          <span className="avatar"><Icon name="tag" size={20} /></span>
          <span className="grow">
            <span className="line-1">Categorías y presupuestos</span>
            <span className="line-2">Organiza tus gastos e ingresos</span>
          </span>
          <Icon name="chevron" size={18} className="faint" />
        </Link>
        <Link to="/movimientos" state={{ exportar: Date.now() }} className="list-item">
          <span className="avatar"><Icon name="download" size={20} /></span>
          <span className="grow">
            <span className="line-1">Exportar movimientos</span>
            <span className="line-2">Archivo CSV para Excel o Google Sheets</span>
          </span>
          <Icon name="chevron" size={18} className="faint" />
        </Link>
      </div>

      <div className="section-title">Apariencia</div>
      <div className="card stack">
        <div>
          <label>Tema</label>
          <div className="seg">
            {[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, t]) => (
              <button key={v} className={prefs.theme === v ? 'on' : ''}
                      onClick={() => setPrefs({ ...prefs, theme: v })}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="between">
          <span className="grow">
            <span className="line-1">Ocultar cifras</span>
            <span className="line-2">Para usar la app en público. También con el ojo de arriba.</span>
          </span>
          <div className="seg" style={{ width: 120 }}>
            <button className={!prefs.hide ? 'on' : ''} onClick={() => setPrefs({ ...prefs, hide: false })}>No</button>
            <button className={prefs.hide ? 'on' : ''} onClick={() => setPrefs({ ...prefs, hide: true })}>Sí</button>
          </div>
        </div>
      </div>

      <div className="section-title">Cuenta</div>
      <div className="card stack">
        <div className="muted small">{session?.user?.email}</div>
        {cambiarClave ? (
          <>
            <PasswordForm
              boton="Cambiar contraseña"
              onDone={() => { setCambiarClave(false); toast('Contraseña actualizada') }}
            />
            <button className="btn btn-ghost btn-block" onClick={() => setCambiarClave(false)}>Cancelar</button>
          </>
        ) : (
          <button className="btn btn-block" onClick={() => setCambiarClave(true)}>
            <Icon name="key" size={18} /> Cambiar contraseña
          </button>
        )}
        <button
          className="btn btn-block neg"
          onClick={() => { if (confirm('¿Cerrar sesión?')) supabase.auth.signOut() }}
        >
          <Icon name="logout" size={18} /> Cerrar sesión
        </button>
      </div>

      <p className="faint small center">Finanzas · tus datos se guardan en tu cuenta de Supabase</p>
    </div>
  )
}
