import { useEffect, useState } from 'react'
import { money, shortDate, daysUntil, todayISO, parseAmount, isExpression } from '../lib/format.js'
import { listAccounts } from '../lib/accounts.js'
import {
  listPending, listHistory, committed, RECURRENCES,
  markPaid, skipPayment, deletePayment
} from '../lib/payments.js'
import PaymentForm from '../components/PaymentForm.jsx'
import Icon from '../components/Icon.jsx'
import { useToast } from '../components/Toast.jsx'
import { estadoFecha } from './Dashboard.jsx'

const recLabel = (v) => RECURRENCES.find(r => r.value === v)?.label ?? ''

export default function Payments() {
  const toast = useToast()
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
        onDone={() => { setEditing(null); load(); toast('Pago guardado') }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  if (paying) {
    return (
      <PayDialog
        payment={paying}
        accounts={accounts}
        onDone={() => { setPaying(null); load(); toast('Pago registrado') }}
        onCancel={() => setPaying(null)}
      />
    )
  }

  const { total, vencido } = committed(pendientes)
  // Para una deuda importa lo que falta; para un ahorro, lo que llevas.
  const saldoDe = (id) => {
    const a = accounts.find(x => x.id === id)
    if (!a) return null
    const monto = money(Math.abs(Number(a.balance)))
    return a.type === 'tarjeta' ? `faltan ${monto}` : `llevas ${monto}`
  }

  // Agrupa por urgencia.
  const grupos = [
    { titulo: 'Vencidos', items: [] },
    { titulo: 'Esta semana', items: [] },
    { titulo: 'Próximos 30 días', items: [] },
    { titulo: 'Más adelante', items: [] }
  ]
  for (const p of pendientes) {
    const d = daysUntil(p.due_date)
    grupos[d < 0 ? 0 : d <= 7 ? 1 : d <= 30 ? 2 : 3].items.push(p)
  }

  return (
    <div className="page stack">
      <div className="card-hero">
        <div className="figure-label">Comprometido en 30 días</div>
        <div className="figure-xl num warn">{money(total)}</div>
        <p className="small faint" style={{ marginTop: 4 }}>
          Incluye las repeticiones: un pago semanal cuenta las veces que cae en el mes.
        </p>
        {vencido > 0 && (
          <div className="badge neg" style={{ marginTop: 10 }}>{money(vencido)} ya vencido</div>
        )}
      </div>

      <button className="btn btn-primary btn-block" onClick={() => setEditing('new')}>
        <Icon name="plus" size={18} /> Programar pago
      </button>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="empty">Cargando…</div>
      ) : pendientes.length === 0 ? (
        <div className="list">
          <div className="empty">
            No tienes pagos programados.<br />
            Agrega el alquiler, la energía, el internet o las cuotas de un préstamo.
          </div>
        </div>
      ) : (
        grupos.filter(g => g.items.length).map(g => (
          <div key={g.titulo}>
            <div className="between">
              <div className={'section-title' + (g.titulo === 'Vencidos' ? ' neg' : '')}>{g.titulo}</div>
              <span className="small faint num" style={{ marginTop: 16, marginRight: 4 }}>
                {money(g.items.reduce((s, p) => s + Number(p.amount), 0))}
              </span>
            </div>
            <div className="list" style={{ marginTop: 6 }}>
              {g.items.map(p => (
                <PendingRow
                  key={p.id}
                  payment={p}
                  restante={p.target_account_id ? saldoDe(p.target_account_id) : null}
                  onPay={() => setPaying(p)}
                  onEdit={() => setEditing(p)}
                  onSkip={async () => {
                    if (!confirm(`¿Omitir "${p.name}" esta vez? No se registrará nada.`)) return
                    try { await skipPayment(p.id); load(); toast('Pago omitido') }
                    catch (e) { setError(e.message) }
                  }}
                  onDelete={async () => {
                    if (!confirm(`¿Borrar "${p.name}" y su recurrencia?`)) return
                    try { await deletePayment(p.id); load(); toast('Pago borrado') }
                    catch (e) { setError(e.message) }
                  }}
                />
              ))}
            </div>
          </div>
        ))
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
                  <span className="avatar">{p.status === 'pagado' ? '✅' : '⏭️'}</span>
                  <span className="grow">
                    <span className="line-1">{p.name}</span>
                    <span className="line-2">
                      {shortDate(p.due_date)} · {p.status === 'pagado' ? 'pagado' : 'omitido'}
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
  const { texto, clase } = estadoFecha(p.due_date)
  const rec = p.recurrence && p.recurrence !== 'ninguna' ? recLabel(p.recurrence).toLowerCase() : ''

  return (
    <>
      <div className="list-item" onClick={() => setOpen(v => !v)} role="button" aria-expanded={open}>
        <span className="avatar">{p.target?.emoji ?? p.category?.emoji ?? '📅'}</span>
        <span className="grow">
          <span className="line-1">{p.name}</span>
          <span className="line-2">
            <span className={clase}>{texto}</span>
            {rec && ` · ${rec}`}
            {restante && ` · ${restante}`}
          </span>
        </span>
        <span className="figure-md num">{money(p.amount)}</span>
        <button
          className="btn btn-sm"
          style={{ flex: 'none' }}
          onClick={(e) => { e.stopPropagation(); onPay() }}
          aria-label={`Pagar ${p.name}`}
        >
          Pagar
        </button>
      </div>

      {open && (
        <div className="list-actions">
          <button className="btn" onClick={onEdit}>Editar</button>
          <button className="btn" onClick={onSkip}>Omitir esta vez</button>
          <button className="btn btn-ghost neg" style={{ marginLeft: 'auto' }} onClick={onDelete}>
            Borrar
          </button>
        </div>
      )}
    </>
  )
}

function PayDialog({ payment: p, accounts, onDone, onCancel }) {
  const [accountId, setAccountId] = useState(p.account_id ?? accounts[0]?.id ?? '')
  const [amount, setAmount] = useState(String(p.amount))
  const [paidOn, setPaidOn] = useState(todayISO())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const destino = accounts.find(a => a.id === p.target_account_id)
  const saldoDestino = destino ? money(Math.abs(Number(destino.balance))) : ''
  const origen = accounts.find(a => a.id === accountId)

  async function confirmar() {
    if (!accountId) { setError('Elige la cuenta de donde salió'); return }
    if (String(amount).trim() !== '' && !(parseAmount(amount) > 0)) {
      setError('El monto tiene que ser un número mayor que cero'); return
    }
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
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          <Icon name="back" size={18} /> Cancelar
        </button>
        <span className="figure-label">Registrar pago</span>
      </div>

      <div className="card stack">
        <div>
          <div style={{ fontWeight: 650, fontSize: 17 }}>{p.name}</div>
          <div className="faint small">
            Vencía el {shortDate(p.due_date)}
            {p.recurrence && p.recurrence !== 'ninguna' && ` · ${recLabel(p.recurrence).toLowerCase()}`}
          </div>
          {destino && (
            <div className="muted small" style={{ marginTop: 6 }}>
              Abona a {destino.emoji} {destino.name} ·{' '}
              {destino.type === 'tarjeta' ? `faltan ${saldoDestino}` : `llevas ${saldoDestino}`}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="monto">Monto real</label>
          <input
            id="monto" type="text" inputMode="decimal" className="input-amount"
            value={amount} onChange={e => setAmount(e.target.value)}
          />
          <p className="hint">
            {isExpression(amount) && !Number.isNaN(parseAmount(amount)) ? `= ${money(parseAmount(amount))}. ` : ''}
            Si pagaste más o menos de la cuota, corrígelo aquí.
          </p>
        </div>

        <div>
          <label htmlFor="cuenta">Salió de</label>
          <select id="cuenta" value={accountId} onChange={e => setAccountId(e.target.value)}>
            <option value="">Elegir…</option>
            {accounts
              .filter(a => a.id !== p.target_account_id)
              .map(a => (
                <option key={a.id} value={a.id}>{a.emoji} {a.name} · {money(a.balance)}</option>
              ))}
          </select>
          {origen && origen.type !== 'tarjeta' && Number(origen.balance) < (parseAmount(amount) || 0) && (
            <p className="hint warn">No alcanza: esta cuenta tiene {money(origen.balance)}.</p>
          )}
        </div>

        <div>
          <label htmlFor="fecha">Fecha del pago</label>
          <input id="fecha" type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} />
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <button className="btn btn-primary btn-block btn-lg" onClick={confirmar} disabled={busy}>
        {busy ? 'Registrando…' : 'Confirmar pago'}
      </button>
    </div>
  )
}
