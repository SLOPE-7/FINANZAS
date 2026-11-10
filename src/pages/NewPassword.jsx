import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { traducir } from './Login.jsx'

// Formulario para fijar una contraseña nueva. Se usa al volver del
// enlace de recuperación y desde "Más" para cambiarla.
export function PasswordForm({ onDone, boton = 'Guardar contraseña' }) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (p1.length < 8) { setError('Mínimo 8 caracteres.'); return }
    if (p1 !== p2) { setError('Las contraseñas no coinciden.'); return }
    setBusy(true); setError('')
    const { error } = await supabase.auth.updateUser({ password: p1 })
    setBusy(false)
    if (error) { setError(traducir(error.message)); return }
    onDone?.()
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div>
        <label htmlFor="p1">Contraseña nueva</label>
        <input id="p1" type="password" autoComplete="new-password" minLength={8} required
               value={p1} onChange={e => setP1(e.target.value)} />
      </div>
      <div>
        <label htmlFor="p2">Repítela</label>
        <input id="p2" type="password" autoComplete="new-password" minLength={8} required
               value={p2} onChange={e => setP2(e.target.value)} />
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? 'Guardando…' : boton}
      </button>
    </form>
  )
}

export default function NewPassword({ onDone }) {
  return (
    <div className="auth">
      <div className="auth-box stack">
        <div>
          <img src="/icon.svg" alt="" className="auth-logo" />
          <h1>Nueva contraseña</h1>
          <p className="faint" style={{ fontSize: 14 }}>Escribe la contraseña que usarás desde ahora.</p>
        </div>
        <PasswordForm onDone={onDone} />
      </div>
    </div>
  )
}
