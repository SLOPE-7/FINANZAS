import { useEffect, useState } from 'react'
import { todayISO, money, parseAmount, isExpression } from '../lib/format.js'
import { listAccounts } from '../lib/accounts.js'
import { RECURRENCES, createPayment, updatePayment } from '../lib/payments.js'
import CategorySelect from './CategorySelect.jsx'
import Icon from './Icon.jsx'

export default function PaymentForm({ payment, onDone, onCancel }) {
  const [v, setV] = useState({
    name: payment?.name ?? '',
    amount: payment?.amount ?? '',
    due_date: payment?.due_date ?? todayISO(),
    recurrence: payment?.recurrence ?? 'mensual',
    category_id: payment?.category_id ?? '',
    account_id: payment?.account_id ?? '',
    target_account_id: payment?.target_account_id ?? '',
    notify: payment?.notify ?? true
  })
  const [accounts, setAccounts] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setV(prev => ({ ...prev, [k]: e.target.value }))
  const abona = !!v.target_account_id

  useEffect(() => {
    listAccounts().then(setAccounts).catch(e => setError(e.message))
  }, [])

  // Solo tiene sentido abonar a deudas o ahorros, no a la cuenta corriente.
  const destinos = accounts.filter(a =>
    a.type === 'tarjeta' || a.type === 'ahorro'
  )

  const destino = accounts.find(a => a.id === v.target_account_id)
  const esDeuda = destino?.type === 'tarjeta'
  const saldoDestino = destino ? Math.abs(Number(destino.balance)) : 0

  async function save() {
    if (!v.name.trim()) { setError('Ponle un nombre al pago'); return }
    if (!(parseAmount(v.amount) > 0)) { setError('El monto tiene que ser un número mayor que cero'); return }
    if (!v.due_date) { setError('Elige la fecha del próximo pago'); return }

    setBusy(true); setError('')
    try {
      if (payment) await updatePayment(payment.id, v)
      else await createPayment(v)
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
        <span className="figure-label">
          {payment ? 'Editar pago' : 'Nuevo pago programado'}
        </span>
      </div>

      <div className="card stack">
        <div>
          <label htmlFor="name">Nombre</label>
          <input id="name" value={v.name} onChange={set('name')} placeholder="Cuota de la tablet" />
        </div>

        <div>
          <label htmlFor="amount">Monto de cada cuota</label>
          <input
            id="amount" type="text" inputMode="decimal"
            value={v.amount} onChange={set('amount')}
            placeholder="0.00"
            className="input-amount"
            autoComplete="off"
          />
          {isExpression(v.amount) && !Number.isNaN(parseAmount(v.amount)) && (
            <p className="hint num">= {money(parseAmount(v.amount))}</p>
          )}
        </div>

        <div>
          <label htmlFor="due">Próxima fecha de pago</label>
          <input id="due" type="date" value={v.due_date} onChange={set('due_date')} />
        </div>

        <div>
          <label>Se repite</label>
          <div className="chips wrap">
            {RECURRENCES.map(r => (
              <button key={r.value} type="button"
                      className={'chip' + (v.recurrence === r.value ? ' on' : '')}
                      onClick={() => setV(prev => ({ ...prev, recurrence: r.value }))}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card stack">
        <div>
          <label htmlFor="target">¿Abona a una deuda o ahorro?</label>
          <select id="target" value={v.target_account_id} onChange={set('target_account_id')}>
            <option value="">No, es un gasto normal</option>
            {destinos.map(a => (
              <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
            ))}
          </select>

          {abona ? (
            <p className="hint">
              {esDeuda
                ? `Faltan ${money(saldoDestino)}. Cada cuota baja esa deuda y no cuenta como gasto.`
                : `Llevas ${money(saldoDestino)} ahorrado. Cada cuota se suma y no cuenta como gasto.`}
            </p>
          ) : (
            <p className="hint">
              Para llevar el total pendiente, crea primero la cuenta en Cuentas
              (tipo Tarjeta con el saldo en negativo, o Ahorro apartado).
            </p>
          )}
        </div>

        {!abona && (
          <div>
            <label htmlFor="cat">Categoría</label>
            <CategorySelect
              id="cat"
              kind="egreso"
              value={v.category_id}
              onChange={set('category_id')}
            />
          </div>
        )}

        <div>
          <label htmlFor="acc">Cuenta habitual (opcional)</label>
          <select id="acc" value={v.account_id} onChange={set('account_id')}>
            <option value="">Preguntar cada vez</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <button className="btn btn-primary btn-block btn-lg" onClick={save} disabled={busy}>
        {busy ? 'Guardando…' : payment ? 'Guardar cambios' : 'Crear pago'}
      </button>
    </div>
  )
}
