import { useEffect, useState } from 'react'
import { todayISO } from '../lib/format.js'
import { listAccounts } from '../lib/accounts.js'
import { createTransaction, updateTransaction } from '../lib/transactions.js'
import CategorySelect from './CategorySelect.jsx'

const TABS = [
  { kind: 'egreso',        label: 'Gasto' },
  { kind: 'ingreso',       label: 'Ingreso' },
  { kind: 'transferencia', label: 'Transferencia' }
]

export default function TransactionForm({ tx, onDone, onCancel }) {
  const [v, setV] = useState({
    kind: tx?.kind ?? 'egreso',
    amount: tx?.amount ?? '',
    occurred_on: tx?.occurred_on ?? todayISO(),
    account_id: tx?.account_id ?? '',
    to_account_id: tx?.to_account_id ?? '',
    category_id: tx?.category_id ?? '',
    description: tx?.description ?? '',
    note: tx?.note ?? ''
  })
  const [accounts, setAccounts] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const esTransferencia = v.kind === 'transferencia'
  const set = (k) => (e) => setV(prev => ({ ...prev, [k]: e.target.value }))

  useEffect(() => {
    listAccounts()
      .then(list => {
        setAccounts(list)
        if (!v.account_id && list.length) {
          setV(prev => ({ ...prev, account_id: list[0].id }))
        }
      })
      .catch(e => setError(e.message))
  }, [])

  function cambiarTipo(kind) {
    setV(prev => ({ ...prev, kind, category_id: '', to_account_id: '' }))
    setError('')
  }

  async function save() {
    if (!v.account_id) { setError('Elige una cuenta'); return }
    if (Number(v.amount) <= 0) { setError('El monto tiene que ser mayor que cero'); return }
    if (esTransferencia && !v.to_account_id) { setError('Elige la cuenta de destino'); return }
    if (esTransferencia && v.account_id === v.to_account_id) {
      setError('Las dos cuentas deben ser distintas'); return
    }

    setBusy(true); setError('')
    try {
      if (tx) await updateTransaction(tx.id, v)
      else await createTransaction(v)
      onDone()
    } catch (e) {
      setError(e.message); setBusy(false)
    }
  }

  return (
    <div className="page stack">
      <div className="between">
        <span className="section-title" style={{ margin: 0 }}>
          {tx ? 'Editar movimiento' : 'Nuevo movimiento'}
        </span>
        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onCancel}>
          Cancelar
        </button>
      </div>

      <div className="row" style={{ gap: 6 }}>
        {TABS.map(t => (
          <button
            key={t.kind}
            className="btn grow"
            style={{
              fontSize: 13,
              padding: '9px 6px',
              borderColor: v.kind === t.kind ? 'var(--text)' : 'var(--border)',
              color: v.kind === t.kind ? 'var(--text)' : 'var(--muted)'
            }}
            onClick={() => cambiarTipo(t.kind)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card stack">
        <div>
          <label htmlFor="amount">Monto</label>
          <input
            id="amount" type="text" inputMode="decimal"
            value={v.amount} onChange={set('amount')}
            placeholder="0.00"
            style={{ fontSize: 24, fontWeight: 600, padding: '14px 12px' }}
          />
        </div>

        <div>
          <label htmlFor="desc">Concepto</label>
          <input
            id="desc" value={v.description} onChange={set('description')}
            placeholder={esTransferencia ? 'Traslado a efectivo' : 'Supermercado'}
          />
        </div>

        <div>
          <label htmlFor="date">Fecha</label>
          <input id="date" type="date" value={v.occurred_on} onChange={set('occurred_on')} />
        </div>
      </div>

      <div className="card stack">
        <div>
          <label htmlFor="acc">{esTransferencia ? 'Desde' : 'Cuenta'}</label>
          <select id="acc" value={v.account_id} onChange={set('account_id')}>
            <option value="">Elegir…</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
            ))}
          </select>
        </div>

        {esTransferencia ? (
          <div>
            <label htmlFor="dest">Hacia</label>
            <select id="dest" value={v.to_account_id} onChange={set('to_account_id')}>
              <option value="">Elegir…</option>
              {accounts
                .filter(a => a.id !== v.account_id)
                .map(a => (
                  <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
                ))}
            </select>
            <p className="faint" style={{ fontSize: 12, marginTop: 6 }}>
              Una transferencia no cuenta como gasto. El dinero solo cambia de lugar.
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor="cat">Categoría</label>
            <CategorySelect
              id="cat"
              kind={v.kind}
              value={v.category_id}
              onChange={set('category_id')}
            />
          </div>
        )}

        <div>
          <label htmlFor="note">Nota (opcional)</label>
          <input id="note" value={v.note} onChange={set('note')} placeholder="" />
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <button className="btn btn-primary btn-block" onClick={save} disabled={busy}>
        {busy ? 'Guardando…' : tx ? 'Guardar cambios' : 'Registrar'}
      </button>
    </div>
  )
}
