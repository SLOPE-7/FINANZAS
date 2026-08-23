import { useEffect, useState } from 'react'
import { money, shortDate, todayISO } from '../lib/format.js'
import { listTransactions, monthTotals, deleteTransaction } from '../lib/transactions.js'
import TransactionForm from '../components/TransactionForm.jsx'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
               'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export default function Transactions() {
  const [month, setMonth] = useState(todayISO().slice(0, 7) + '-01')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)

  async function load() {
    setLoading(true); setError('')
    try {
      setItems(await listTransactions({ month }))
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [month])

  function moverMes(delta) {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    const p = (x) => String(x).padStart(2, '0')
    setMonth(`${d.getFullYear()}-${p(d.getMonth() + 1)}-01`)
  }

  if (editing) {
    return (
      <TransactionForm
        tx={editing === 'new' ? null : editing}
        onDone={() => { setEditing(null); load() }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  const { ingresos, egresos, balance } = monthTotals(items)
  const [ay, am] = month.split('-').map(Number)
  const grupos = agrupar(items)

  return (
    <div className="page stack">
      <div className="between">
        <button className="btn btn-ghost" onClick={() => moverMes(-1)}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 500 }}>
          {MESES[am - 1]} {ay}
        </span>
        <button className="btn btn-ghost" onClick={() => moverMes(1)}>›</button>
      </div>

      <div className="card">
        <div className="between" style={{ marginBottom: 10 }}>
          <div>
            <div className="figure-label">Ingresos</div>
            <div className="figure-md num pos">{money(ingresos)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="figure-label">Gastos</div>
            <div className="figure-md num neg">{money(egresos)}</div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div className="figure-label">Balance del mes</div>
          <div className={'figure-lg num ' + (balance < 0 ? 'neg' : 'pos')}>
            {money(balance)}
          </div>
        </div>
      </div>

      <button className="btn btn-primary btn-block" onClick={() => setEditing('new')}>
        Registrar movimiento
      </button>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="empty">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="list">
          <div className="empty">Sin movimientos este mes.</div>
        </div>
      ) : (
        grupos.map(([fecha, lista]) => (
          <div key={fecha}>
            <div className="section-title">{shortDate(fecha)}</div>
            <div className="list">
              {lista.map(t => (
                <Row
                  key={t.id}
                  tx={t}
                  onEdit={() => setEditing(t)}
                  onDelete={async () => {
                    if (!confirm('¿Borrar este movimiento?')) return
                    try { await deleteTransaction(t.id); load() }
                    catch (e) { setError(e.message) }
                  }}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function Row({ tx: t, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)

  let icono = t.category?.emoji ?? '📌'
  let signo = ''
  let clase = ''
  let detalle = t.category?.name ?? 'Sin categoría'

  if (t.kind === 'ingreso') { signo = '+'; clase = 'pos' }
  if (t.kind === 'egreso')  { signo = '−'; clase = 'neg' }
  if (t.kind === 'transferencia') {
    icono = '🔄'
    detalle = `${t.account?.name ?? '?'} → ${t.destino?.name ?? '?'}`
  } else {
    detalle = `${detalle} · ${t.account?.name ?? ''}`
  }

  return (
    <>
      <button className="list-item" onClick={() => setOpen(v => !v)}>
        <span style={{ fontSize: 18 }}>{icono}</span>
        <span className="grow">
          <span style={{ display: 'block' }}>
            {t.description || (t.kind === 'transferencia' ? 'Transferencia' : 'Sin concepto')}
          </span>
          <span className="faint" style={{ fontSize: 12 }}>{detalle}</span>
        </span>
        <span className={'figure-md num ' + clase}>
          {signo}{money(t.amount)}
        </span>
      </button>

      {open && (
        <div
          className="row"
          style={{ padding: '10px 16px', gap: 8, borderBottom: '1px solid var(--border)' }}
        >
          {t.note && (
            <span className="faint grow" style={{ fontSize: 12 }}>{t.note}</span>
          )}
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onEdit}>
            Editar
          </button>
          <button
            className="btn btn-ghost neg"
            style={{ fontSize: 13, marginLeft: t.note ? 0 : 'auto' }}
            onClick={onDelete}
          >
            Borrar
          </button>
        </div>
      )}
    </>
  )
}

function agrupar(items) {
  const mapa = new Map()
  for (const t of items) {
    if (!mapa.has(t.occurred_on)) mapa.set(t.occurred_on, [])
    mapa.get(t.occurred_on).push(t)
  }
  return [...mapa.entries()]
}
