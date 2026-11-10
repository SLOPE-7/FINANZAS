import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(''); setNotice(''); setBusy(true)

    const fn = mode === 'signin'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password })

    let data, error
    try {
      ({ data, error } = await fn)
    } catch (e) {
      error = e
    }
    setBusy(false)

    if (error) { setError(traducir(error.message)); return }
    if (mode === 'signup' && !data.session) {
      setNotice('Revisa tu correo para confirmar la cuenta.')
    }
  }

  return (
    <div className="auth">
      <form className="auth-box stack" onSubmit={submit}>
        <div>
          <h1>Finanzas</h1>
          <p className="faint" style={{ fontSize: 14 }}>
            {mode === 'signin' ? 'Entra a tu cuenta' : 'Crea tu cuenta'}
          </p>
        </div>

        <div>
          <label htmlFor="email">Correo</label>
          <input
            id="email" type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="password">Contraseña</label>
          <input
            id="password" type="password" required minLength={8}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password} onChange={e => setPassword(e.target.value)}
          />
        </div>

        {error && <div className="error">{error}</div>}
        {notice && <div className="card" style={{ fontSize: 14 }}>{notice}</div>}

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Un momento…' : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}
        >
          {mode === 'signin' ? 'No tengo cuenta' : 'Ya tengo cuenta'}
        </button>
      </form>
    </div>
  )
}

// Supabase responde en inglés; estos son los mensajes más comunes.
function traducir(msg = '') {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.'
  if (m.includes('already registered')) return 'Ya existe una cuenta con ese correo.'
  if (m.includes('password should be')) return 'La contraseña es demasiado corta o débil.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Espera un momento y vuelve a probar.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sin conexión. Revisa tu internet.'
  return msg
}
