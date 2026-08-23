import { useEffect, useState } from 'react'
import { todayISO } from '../lib/format.js'
import { listAccounts } from '../lib/accounts.js'
import { listCategories } from '../lib/categories.js'
import { RECURRENCES, createPayment, updatePayment } from '../lib/payments.js'

export default function PaymentForm({ payment, onDone, onCancel }) {
  const [v, setV] = useState({
    name: payment?.name ?? '',
    amount: payment?.amount ?? '',
    due_date: payment?.due_date ?? todayISO(),
    recurrence: payment?.recurrence ?? 'mensual',
    category_id: payment?.category_id ?? '',
    account_id: payment?.account_id ?? '',
    notify: payment?.notify ?? true
  })
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setV(prev => ({ ...prev, [k]: e.target.value }))

  useEffect(() => {
    listAccounts().then(setAccounts).catch(e => setError(e.message))
    listCategories('egreso').then(setCategories).catch(e => setError(e.message))
  }, [])

  async function save() {
    if (!v.name.trim()) { setError('Ponle un nombre al pago'); return }
    if (Number(v.amount) <= 0) { setError('El monto tiene que ser mayor que cero'); return }

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
        <span className="section-title" style={{ margin: 0 }}>
          {payment ? 'Editar pago' : 'Nuevo pago programado'}
        </span>
        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onCancel}>
          Cancelar
        </button>
      </div>

      <div className="card stack">
        <div>
          <label htmlFor="name">Nombre</label>
          <input id="name" value={v.name} onChange={set('name')} placeholder="Internet" />
        </div>

        <div>
          <label htmlFor="amount">Monto</label>
          <input
            id="amount" type="text" inputMode="decimal"
            value={v.amount} onChange={set('amount')}
            placeholder="0.00"
            style={{ fontSize: 22, fontWeight: 600, padding: '13px 12px' }}
          />
        </div>

        <div>
          <label htmlFor="due">Próxima fecha de pago</label>
          <input id="due" type="date" value={v.due_date} onChange={set('due_date')} />
        </div>

        <div>
          <label htmlFor="rec">Se repite</label>
          <select id="rec" value={v.recurrence} onChange={set('rec')} onChangeCapture={set('recurrence')}>
            {RECURRENCES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <p className="faint" style={{ fontSize: 12, marginTop: 6 }}>
            Al marcarlo pagado se crea el gasto real y aparece la siguiente fecha.
          </p>
        </div>
      </div>

      <div className="card stack">
        <div>
          <label htmlFor="cat">Categoría</label>
          <select id="cat" value={v.category_id} onChange={set('category_id')}>
            <option value="">Sin categoría</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
            ))}
          </select>
        </div>

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

      <button className="btn btn-primary btn-block" onClick={save} disabled={busy}>
        {busy ? 'Guardando…' : payment ? 'Guardar cambios' : 'Crear pago'}
      </button>
    </div>
  )
}
