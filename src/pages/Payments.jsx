import { useEffect, useState } from 'react'
import { money, shortDate, daysUntil, todayISO } from '../lib/format.js'
import { listAccounts } from '../lib/accounts.js'
import {
  listPending, listHistory, committed,
  markPaid, skipPayment, deletePayment
} from '../lib/payments.js'
import PaymentForm from '../components/PaymentForm.jsx'

export default function Payments() {
  const [pendientes, setPendientes] = useState([])
  const [historial, setHistorial] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [paying, setPaying] = useState(null)
  const [verHistorial, setVerHistorial] = useState(false)

  async function load() {
    setLoading(true); setError('')
    try {
      const [p, h, a] = await Promise.all([
        listPending(), listHistory(), listAccounts()
      ])
      setPendientes(p); setHistorial(h); setAccounts(a)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (editing) {
    return (
      <PaymentForm
        payment={editing === 'new' ? null : editing}
        onDone={() => { setEditing(null); load() }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  if (paying) {
    return (
      <PayDialog
        payment={paying}
        accounts={accounts}
        onDone={() => { setPaying(null); load() }}
        onCancel={() => setPaying(null)}
      />
    )
  }

  const { total, vencido } = committed(pendientes)
  const saldoDe = (id) => {
    const a = accounts.find(x => x.id === id)
    return a ? Math.abs(Number(a.balance)) : null
  }

  return (
    <div className="page stack">
      <div className="card">
        <div className="figure-label">Comprometido en 30 días</div>
        <div className="figure-lg num warn">{money(total)}</div>
        {vencido > 0 && (
          <div className="neg" style={{ fontSize: 13, marginTop: 6 }}>
            {money(vencido)} ya vencido
          </div>
        )}
      </div>

      <button className="btn btn-primary btn-block" onClick={() => setEditing('new')}>
        Programar pago
      </button>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="empty">Cargando…</div>
      ) : pendientes.length === 0 ? (
        <div className="list">
          <div className="empty">
            No tienes pagos programados.<br />
            Agrega el alquiler, la energía, el internet.
          </div>
        </div>
      ) : (
        <>
          <div className="section-title">Pendientes</div>
          <div className="list">
            {pendientes.map(p => (
              <PendingRow
                key={p.id}
                payment={p}
                restante={p.target_account_id ? saldoDe(p.target_account_id) : null}
                onPay={() => setPaying(p)}
                onEdit={() => setEditing(p)}
                onSkip={async () => {
                  if (!confirm(`¿Omitir "${p.name}"? No se registrará nada.`)) return
                  try { await skipPayment(p.id); load() } catch (e) { setError(e.message) }
                }}
                onDelete={async () => {
                  if (!confirm(`¿Borrar "${p.name}" y su recurrencia?`)) return
                  try { await deletePayment(p.id); load() } catch (e) { setError(e.message) }
                }}
              />
            ))}
          </div>
        </>
      )}

      {historial.length > 0 && (
        <>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => setVerHistorial(v => !v)}
          >
            {verHistorial ? 'Ocultar historial' : 'Ver historial'}
          </button>

          {verHistorial && (
            <div className="list">
              {historial.map(p => (
                <div key={p.id} className="list-item" style={{ cursor: 'default' }}>
                  <span style={{ fontSize: 18 }}>
                    {p.status === 'pagado' ? '✅' : '⏭️'}
                  </span>
                  <span className="grow">
                    <span style={{ display: 'block' }}>{p.name}</span>
                    <span className="faint" style={{ fontSize: 12 }}>
                      {shortDate(p.due_date)} · {p.status}
                    </span>
                  </span>
                  <span className="figure-md num faint">{money(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PendingRow({ payment: p, restante, onPay, onEdit, onSkip, onDelete }) {
  const [open, setOpen] = useState(false)
  const dias = daysUntil(p.due_date)

  let estado, clase
  if (dias < 0)       { estado = `vencido hace ${Math.abs(dias)} d`; clase = 'neg' }
  else if (dias === 0){ estado = 'vence hoy';        clase = 'neg' }
  else if (dias <= 3) { estado = `en ${dias} días`;  clase = 'warn' }
  else                { estado = shortDate(p.due_date); clase = 'faint' }

  return (
    <>
      <button className="list-item" onClick={() => setOpen(v => !v)}>
        <span style={{ fontSize: 18 }}>
          {p.target?.emoji ?? p.category?.emoji ?? '📅'}
        </span>
        <span className="grow">
          <span style={{ display: 'block' }}>{p.name}</span>
          <span className={clase} style={{ fontSize: 12 }}>
            {estado}
            {restante !== null && (
              <span className="faint"> · faltan {money(restante)}</span>
            )}
          </span>
        </span>
        <span className="figure-md num">{money(p.amount)}</span>
      </button>

      {open && (
        <div
          className="row"
          style={{ padding: '10px 16px', gap: 8, borderBottom: '1px solid var(--border)',
                   flexWrap: 'wrap' }}
        >
          <button className="btn" style={{ fontSize: 13 }} onClick={onPay}>
            Marcar pagado
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onEdit}>
            Editar
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onSkip}>
            Omitir
          </button>
          <button
            className="btn btn-ghost neg"
            style={{ fontSize: 13, marginLeft: 'auto' }}
            onClick={onDelete}
          >
            Borrar
          </button>
        </div>
      )}
    </>
  )
}

function PayDialog({ payment: p, accounts, onDone, onCancel }) {
  const [accountId, setAccountId] = useState(p.account_id ?? accounts[0]?.id ?? '')
  const [amount, setAmount] = useState(p.amount)
  const [paidOn, setPaidOn] = useState(todayISO())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const destino = accounts.find(a => a.id === p.target_account_id)
  const restante = destino ? Math.abs(Number(destino.balance)) : null

  async function confirmar() {
    if (!accountId) { setError('Elige la cuenta de donde salió'); return }
    setBusy(true); setError('')
    try {
      await markPaid({ paymentId: p.id, accountId, paidOn, amount })
      onDone()
    } catch (e) {
      setError(e.message); setBusy(false)
    }
  }

  return (
    <div className="page stack">
      <div className="between">
        <span className="section-title" style={{ margin: 0 }}>Registrar pago</span>
        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onCancel}>
          Cancelar
        </button>
      </div>

      <div className="card stack">
        <div>
          <div className="figure-label">{p.name}</div>
          <div className="faint" style={{ fontSize: 13 }}>
            Vencía el {shortDate(p.due_date)}
          </div>
          {destino && (
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              Abona a {destino.emoji} {destino.name} · faltan {money(restante)}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="monto">Monto real</label>
          <input
            id="monto" type="text" inputMode="decimal"
            value={amount} onChange={e => setAmount(e.target.value)}
            style={{ fontSize: 22, fontWeight: 600, padding: '13px 12px' }}
          />
          <p className="faint" style={{ fontSize: 12, marginTop: 6 }}>
            Si abonas más o menos de la cuota, corrígelo aquí.
          </p>
        </div>

        <div>
          <label htmlFor="cuenta">Salió de</label>
          <select id="cuenta" value={accountId} onChange={e => setAccountId(e.target.value)}>
            <option value="">Elegir…</option>
            {accounts
              .filter(a => a.id !== p.target_account_id)
              .map(a => (
                <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
              ))}
          </select>
        </div>

        <div>
          <label htmlFor="fecha">Fecha del pago</label>
          <input id="fecha" type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} />
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <button className="btn btn-primary btn-block" onClick={confirmar} disabled={busy}>
        {busy ? 'Registrando…' : 'Confirmar pago'}
      </button>
    </div>
  )
}
