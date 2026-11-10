import { useState } from 'react'
import { money, todayISO, shortDate } from '../lib/format.js'
import { esDeuda } from '../lib/accounts.js'
import { breakdown, payDebt } from '../lib/debts.js'
import Icon from './Icon.jsx'

// Pago de una cuota de préstamo o tarjeta, separado en capital,
// intereses y otros cargos. Sale de una sola cuenta y se suma todo.
//
// debt: cuenta de la deuda (fila de account_balances).
// payment: pago programado (opcional). Si viene, su monto sugiere el capital
//          y al confirmar la cuota avanza a la siguiente.
export default function DebtPayForm({ debt, payment, accounts, onDone, onCancel }) {
  const origenes = accounts.filter(a => a.id !== debt.id && !esDeuda(a.type))
  const [fromId, setFromId] = useState(payment?.account_id ?? origenes[0]?.id ?? '')
  const [capital, setCapital] = useState(payment ? String(payment.amount) : '')
  const [interes, setInteres] = useState('')
  const [otros, setOtros] = useState('')
  const [verOtros, setVerOtros] = useState(false)
  const [fecha, setFecha] = useState(todayISO())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const b = breakdown({ capital, interes, otros })
  const deudaHoy = Math.abs(Number(debt.balance))
  const deudaDespues = b.valido ? Math.max(0, deudaHoy - b.capital) : deudaHoy
  const origen = accounts.find(a => a.id === fromId)
  const noAlcanza = origen && b.valido && Number(origen.balance) < b.total
  const esPrestamo = debt.type === 'prestamo'
  const original = Number(debt.credit_limit) || 0

  async function confirmar() {
    setBusy(true); setError('')
    try {
      await payDebt({
        fromAccountId: fromId, debtAccount: debt,
        capital, interes, otros, fecha,
        paymentId: payment?.id ?? null,
        nombre: payment?.name || debt.name
      })
      onDone(b)
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
        <span className="figure-label">{esPrestamo ? 'Pagar cuota' : 'Pagar tarjeta'}</span>
      </div>

      <div className="card">
        <div className="row">
          <span className="avatar">{debt.emoji}</span>
          <div className="grow">
            <div style={{ fontWeight: 650 }}>{payment?.name || debt.name}</div>
            <div className="small faint">
              {payment ? `Cuota del ${shortDate(payment.due_date)} · ` : ''}
              Debes {money(deudaHoy)}
            </div>
          </div>
        </div>
        {esPrestamo && original > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="progress">
              <div style={{ width: `${Math.min(100, ((original - deudaHoy) / original) * 100)}%`, background: 'var(--pos)' }} />
            </div>
            <div className="small faint" style={{ marginTop: 4 }}>
              Pagado {money(Math.max(0, original - deudaHoy))} de {money(original)}
            </div>
          </div>
        )}
      </div>

      <div className="card stack">
        <span className="figure-label">Desglose de la cuota</span>

        <Monto id="capital" etiqueta="Abono a capital" ayuda="Lo que baja tu deuda"
               valor={capital} onChange={setCapital} autoFocus={!payment} />
        <Monto id="interes" etiqueta="Intereses" ayuda="Se registra como gasto"
               valor={interes} onChange={setInteres} autoFocus={!!payment} />

        {verOtros ? (
          <Monto id="otros" etiqueta="Seguro, comisiones, mora" ayuda="Se registra como gasto"
                 valor={otros} onChange={setOtros} />
        ) : (
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}
                  onClick={() => setVerOtros(true)}>
            + Seguro, comisiones o mora
          </button>
        )}

        <div className="divider" style={{ marginTop: 4 }}>
          <div className="between small muted">
            <span>Capital</span><span className="num">{money(b.capital || 0)}</span>
          </div>
          <div className="between small muted" style={{ marginTop: 2 }}>
            <span>+ Intereses{b.otros ? ' y cargos' : ''}</span>
            <span className="num">{money((b.interes || 0) + (b.otros || 0))}</span>
          </div>
          <div className="between" style={{ marginTop: 8 }}>
            <span className="figure-label">Total a pagar</span>
            <span className={'figure-lg num ' + (b.valido ? '' : 'neg')}>
              {b.valido ? money(b.total) : '—'}
            </span>
          </div>
          {b.valido && b.capital > 0 && (
            <div className="small pos" style={{ marginTop: 4 }}>
              Tu deuda baja a {money(deudaDespues)}
            </div>
          )}
        </div>
      </div>

      <div className="card stack">
        <div>
          <label htmlFor="desde">Sale de</label>
          <select id="desde" value={fromId} onChange={e => setFromId(e.target.value)}>
            <option value="">Elegir…</option>
            {origenes.map(a => (
              <option key={a.id} value={a.id}>{a.emoji} {a.name} · {money(a.balance)}</option>
            ))}
          </select>
          {noAlcanza && (
            <p className="hint warn">No alcanza: esta cuenta tiene {money(origen.balance)}.</p>
          )}
        </div>
        <div>
          <label htmlFor="fpago">Fecha del pago</label>
          <input id="fpago" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <button className="btn btn-primary btn-block btn-lg" onClick={confirmar}
              disabled={busy || !b.valido || !(b.total > 0)}>
        {busy ? 'Registrando…' : b.valido && b.total > 0 ? `Pagar ${money(b.total)}` : 'Pagar'}
      </button>
      <p className="faint small center">
        El capital baja la deuda (no es gasto). Los intereses y cargos sí cuentan como gasto.
      </p>
    </div>
  )
}

function Monto({ id, etiqueta, ayuda, valor, onChange, autoFocus }) {
  return (
    <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
      <div className="grow">
        <label htmlFor={id} style={{ marginBottom: 2 }}>{etiqueta}</label>
        <span className="small faint">{ayuda}</span>
      </div>
      <input
        id={id} type="text" inputMode="decimal" placeholder="0.00" autoComplete="off"
        autoFocus={autoFocus}
        value={valor} onChange={e => onChange(e.target.value)}
        style={{ width: 150, textAlign: 'right', fontSize: 18, fontWeight: 600 }}
        className="num"
      />
    </div>
  )
}
