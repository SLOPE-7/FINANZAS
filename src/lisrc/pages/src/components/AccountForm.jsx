import { useState } from 'react'
import { ACCOUNT_TYPES, createAccount, updateAccount } from '../lib/accounts.js'

const EMOJIS = ['🏦', '💵', '💳', '📱', '🐷', '🏧', '💰', '📊']

export default function AccountForm({ account, onDone, onCancel }) {
  const [v, setV] = useState({
    name: account?.name ?? '',
    type: account?.type ?? 'banco',
    emoji: account?.emoji ?? '🏦',
    initial_balance: account?.initial_balance ?? '',
    credit_limit: account?.credit_limit ?? '',
    statement_day: account?.statement_day ?? '',
    due_day: account?.due_day ?? ''
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const esTarjeta = v.type === 'tarjeta'
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })

  async function save() {
    if (!v.name.trim()) { setError('Ponle un nombre a la cuenta'); return }
    setBusy(true); setError('')
    try {
      if (account) await updateAccount(account.id, v)
      else await createAccount(v)
      onDone()
    } catch (e) {
      setError(e.message); setBusy(false)
    }
  }

  return (
    <div className="page stack">
      <div className="between">
        <span className="section-title" style={{ margin: 0 }}>
          {account ? 'Editar cuenta' : 'Nueva cuenta'}
        </span>
        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onCancel}>
          Cancelar
        </button>
      </div>

      <div className="card stack">
        <div>
          <label htmlFor="name">Nombre</label>
          <input
            id="name" value={v.name} onChange={set('name')}
            placeholder="Banco Atlántida"
          />
        </div>

        <div>
          <label htmlFor="type">Tipo</label>
          <select id="type" value={v.type} onChange={set('type')}>
            {ACCOUNT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Ícono</label>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setV({ ...v, emoji: e })}
                className="btn"
                style={{
                  padding: '8px 10px',
                  fontSize: 18,
                  borderColor: v.emoji === e ? 'var(--text)' : 'var(--border)'
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="initial">
            {esTarjeta ? 'Saldo actual de la tarjeta' : 'Saldo actual'}
          </label>
          <input
            id="initial" type="text" inputMode="decimal"
            value={v.initial_balance} onChange={set('initial_balance')}
            placeholder="0.00"
          />
          <p className="faint" style={{ fontSize: 12, marginTop: 6 }}>
            {esTarjeta
              ? 'Lo que debes hoy, en negativo. Si debes L 4,500 escribe -4500.'
              : 'Lo que tienes hoy en esta cuenta. Desde aquí se calcula todo.'}
          </p>
        </div>
      </div>

      {esTarjeta && (
        <div className="card stack">
          <span className="figure-label">Datos de la tarjeta</span>

          <div>
            <label htmlFor="limit">Límite de crédito</label>
            <input
              id="limit" type="text" inputMode="decimal"
              value={v.credit_limit} onChange={set('credit_limit')}
              placeholder="30000"
            />
          </div>

          <div className="row" style={{ gap: 12 }}>
            <div className="grow">
              <label htmlFor="cut">Día de corte</label>
              <input
                id="cut" type="number" min="1" max="31"
                value={v.statement_day} onChange={set('statement_day')}
                placeholder="15"
              />
            </div>
            <div className="grow">
              <label htmlFor="due">Día de pago</label>
              <input
                id="due" type="number" min="1" max="31"
                value={v.due_day} onChange={set('due_day')}
                placeholder="30"
              />
            </div>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <button className="btn btn-primary btn-block" onClick={save} disabled={busy}>
        {busy ? 'Guardando…' : account ? 'Guardar cambios' : 'Crear cuenta'}
      </button>
    </div>
  )
}
