import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  // signin | signup | reset
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  function cambiar(m) { setMode(m); setError(''); setNotice('') }

  async function submit(e) {
    e.preventDefault()
    setError(''); setNotice(''); setBusy(true)

    let data, error
    try {
      if (mode === 'reset') {
        ({ error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        }))
      } else if (mode === 'signin') {
        ({ data, error } = await supabase.auth.signInWithPassword({ email, password }))
      } else {
        ({ data, error } = await supabase.auth.signUp({ email, password }))
      }
    } catch (e) {
      error = e
    }
    setBusy(false)

    if (error) { setError(traducir(error.message)); return }
    if (mode === 'reset') {
      setNotice('Si el correo está registrado, te llegará un enlace para crear una contraseña nueva.')
    } else if (mode === 'signup' && !data?.session) {
      setNotice('Revisa tu correo para confirmar la cuenta.')
    }
  }

  const subtitulo = {
    signin: 'Entra a tu cuenta',
    signup: 'Crea tu cuenta',
    reset: 'Te enviaremos un enlace para restablecerla'
  }[mode]

  return (
    <div className="auth">
      <form className="auth-box stack" onSubmit={submit}>
        <div>
          <img src="/icon.svg" alt="" className="auth-logo" />
          <h1>Finanzas</h1>
          <p className="faint" style={{ fontSize: 14 }}>{subtitulo}</p>
        </div>

        <div>
          <label htmlFor="email">Correo</label>
          <input
            id="email" type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
          />
        </div>

        {mode !== 'reset' && (
          <div>
            <label htmlFor="password">Contraseña</label>
            <input
              id="password" type="password" required minLength={8}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password} onChange={e => setPassword(e.target.value)}
            />
            {mode === 'signup' && <p className="hint">Mínimo 8 caracteres.</p>}
          </div>
        )}

        {error && <div className="error">{error}</div>}
        {notice && <div className="notice">{notice}</div>}

        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Un momento…'
            : mode === 'signin' ? 'Entrar'
            : mode === 'signup' ? 'Crear cuenta'
            : 'Enviar enlace'}
        </button>

        {mode === 'signin' && (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => cambiar('reset')}>
            Olvidé mi contraseña
          </button>
        )}

        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => cambiar(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'No tengo cuenta' : 'Ya tengo cuenta'}
        </button>
      </form>
    </div>
  )
}

// Supabase responde en inglés; estos son los mensajes más comunes.
export function traducir(msg = '') {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.'
  if (m.includes('already registered')) return 'Ya existe una cuenta con ese correo.'
  if (m.includes('should be different')) return 'La contraseña nueva debe ser distinta de la anterior.'
  if (m.includes('password should be')) return 'La contraseña es demasiado corta o débil.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Espera un momento y vuelve a probar.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sin conexión. Revisa tu internet.'
  return msg
}
