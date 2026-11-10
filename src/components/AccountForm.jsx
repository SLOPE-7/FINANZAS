import { useState } from 'react'
import { parseAmount } from '../lib/format.js'
import Icon from './Icon.jsx'
import { ACCOUNT_TYPES, createAccount, updateAccount } from '../lib/accounts.js'

const EMOJIS = ['🏦', '💵', '💳', '📱', '🐷', '🏧', '💰', '📊', '🤝', '💼']

export default function AccountForm({ account, onDone, onCancel }) {
  const inicial = Number(account?.initial_balance ?? 0)
  const esDeudaInicial = account?.type === 'tarjeta'

  const [v, setV] = useState({
    name: account?.name ?? '',
    type: account?.type ?? 'banco',
    emoji: account?.emoji ?? '🏦',
    initial_balance: account
      ? String(esDeudaInicial ? Math.abs(inicial) : inicial)
      : '',
    credit_limit: account?.credit_limit ?? '',
    statement_day: account?.statement_day ?? '',
    due_day: account?.due_day ?? ''
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const esTarjeta = v.type === 'tarjeta'
  const set = (k) => (e) => setV(prev => ({ ...prev, [k]: e.target.value }))


  async function save() {
    if (!v.name.trim()) { setError('Ponle un nombre a la cuenta'); return }

    // Acepta comas de miles y espacios: en el móvil es fácil que se cuelen.
    const monto = v.initial_balance === '' ? 0 : parseAmount(v.initial_balance)
    if (Number.isNaN(monto)) {
      setError('El saldo no es un número válido')
      return
    }
    if (esTarjeta && v.credit_limit !== '' && !(parseAmount(v.credit_limit) >= 0)) {
      setError('El límite de crédito no es un número válido')
      return
    }

    setBusy(true); setError('')

    // En tarjetas se pide en positivo porque el teclado del móvil
    // no trae signo menos; el negativo se aplica aquí.
    const valores = {
      ...v,
      initial_balance: esTarjeta ? -Math.abs(monto) : monto
    }

    try {
      if (account) await updateAccount(account.id, valores)
      else await createAccount(valores)
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
          {account ? 'Editar cuenta' : 'Nueva cuenta'}
        </span>
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
          <select id="type" value={v.type} onChange={e => {
            const type = e.target.value
            const sugerido = ACCOUNT_TYPES.find(t => t.value === type)?.emoji
            setV(prev => ({
              ...prev, type,
              // Cambia el ícono solo si seguía el del tipo anterior.
              emoji: ACCOUNT_TYPES.some(t => t.emoji === prev.emoji) && sugerido ? sugerido : prev.emoji
            }))
          }}>
            {ACCOUNT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Ícono</label>
          <div className="row wrap" style={{ gap: 6 }}>
            {EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setV(prev => ({ ...prev, emoji: e }))}
                className={'chip' + (v.emoji === e ? ' on' : '')}
                style={{ fontSize: 18, padding: '6px 10px' }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="initial">
            {esTarjeta ? 'Deuda de partida' : 'Saldo de partida'}
          </label>
          <input
            id="initial" type="text" inputMode="decimal"
            value={v.initial_balance} onChange={set('initial_balance')}
            placeholder="0.00"
          />
          <p className="hint">
            {account
              ? 'Es el punto de partida, no el saldo de hoy. El saldo actual sale de sumar los movimientos a este número. Cámbialo solo si vas a recalcular.'
              : esTarjeta
                ? 'Lo que debes hoy, en positivo. La app lo registra como deuda.'
                : 'Lo que tienes hoy. A partir de aquí se suman los movimientos que registres.'}
          </p>
        </div>
      </div>

      {esTarjeta && (
        <div className="card stack">
          <span className="figure-label">Datos de la tarjeta (opcional)</span>

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

      <button className="btn btn-primary btn-block btn-lg" onClick={save} disabled={busy}>
        {busy ? 'Guardando…' : account ? 'Guardar cambios' : 'Crear cuenta'}
      </button>
    </div>
  )
}
