import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase, configError } from './lib/supabase.js'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Accounts from './pages/Accounts.jsx'
import Transactions from './pages/Transactions.jsx'
import Payments from './pages/Payments.jsx'
import Categories from './pages/Categories.jsx'
import BlankReceipt from './pages/BlankReceipt.jsx'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    // Si getSession falla (sin red, token corrupto) se muestra el login
    // en vez de quedarse en "Cargando…" para siempre.
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch(e => console.error('getSession:', e.message))
      .finally(() => setLoading(false))

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
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

  if (!session) {
    return <Login />
  }

  return (
    <Layout session={session}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/movimientos" element={<Transactions />} />
        <Route path="/pagos" element={<Payments />} />
        <Route path="/cuentas" element={<Accounts />} />
        <Route path="/recibo" element={<BlankReceipt />} />
        <Route path="/ajustes" element={<Categories />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
