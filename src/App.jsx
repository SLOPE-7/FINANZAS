import { useEffect, useMemo, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase, configError } from './lib/supabase.js'
import { loadPrefs, savePrefs, applyPrefs, PrefsContext } from './lib/prefs.js'
import { ToastProvider } from './components/Toast.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import NewPassword from './pages/NewPassword.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Accounts from './pages/Accounts.jsx'
import Transactions from './pages/Transactions.jsx'
import Payments from './pages/Payments.jsx'
import Categories from './pages/Categories.jsx'
import BlankReceipt from './pages/BlankReceipt.jsx'
import More from './pages/More.jsx'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const [prefs, setPrefsState] = useState(loadPrefs)

  // Cambiar una preferencia re-renderiza toda la app, así las cifras
  // ocultas o el tema se aplican al instante en cualquier pantalla.
  const prefsValue = useMemo(() => ({
    prefs,
    setPrefs: (p) => { applyPrefs(p); savePrefs(p); setPrefsState(p) }
  }), [prefs])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    // Si getSession falla (sin red, token corrupto) se muestra el login
    // en vez de quedarse en "Cargando…" para siempre.
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch(e => console.error('getSession:', e.message))
      .finally(() => setLoading(false))

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Llegó desde el enlace de "Olvidé mi contraseña".
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session || !supabase) return
    supabase.rpc('seed_default_categories').then(({ error }) => {
      if (error) console.error('seed_default_categories:', error.message)
    })
  }, [session?.user?.id])

  if (configError) {
    return <div className="auth"><div className="error">{configError}</div></div>
  }

  if (loading) {
    return <div className="auth"><span className="faint">Cargando…</span></div>
  }

  if (recovery && session) {
    return <NewPassword onDone={() => setRecovery(false)} />
  }

  if (!session) {
    return <Login />
  }

  return (
    <PrefsContext.Provider value={prefsValue}>
      <ToastProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/movimientos" element={<Transactions />} />
            <Route path="/pagos" element={<Payments />} />
            <Route path="/cuentas" element={<Accounts />} />
            <Route path="/recibo" element={<BlankReceipt />} />
            <Route path="/ajustes" element={<Categories />} />
            <Route path="/mas" element={<More session={session} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </ToastProvider>
    </PrefsContext.Provider>
  )
}
