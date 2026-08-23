import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase.js'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Placeholder from './pages/Placeholder.jsx'
import Accounts from './pages/Accounts.jsx'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    supabase.rpc('seed_default_categories').then(({ error }) => {
      if (error) console.error('seed_default_categories:', error.message)
    })
  }, [session?.user?.id])

  if (loading) {
    return <div className="auth"><span className="faint">Cargando…</span></div>
  }

  if (!session) {
    return <Login />
  }

  return (
    <Layout session={session}>
      <Routes>
        <Route path="/" element={<Placeholder title="Inicio" />} />
        <Route path="/movimientos" element={<Placeholder title="Movimientos" />} />
        <Route path="/pagos" element={<Placeholder title="Pagos" />} />
        <Route path="/cuentas" element={<Accounts />} />
        <Route path="/ajustes" element={<Placeholder title="Ajustes" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
