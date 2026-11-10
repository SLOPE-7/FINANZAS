import { useEffect, useMemo, useState } from 'react'
import { todayISO, parseAmount, isExpression, money } from '../lib/format.js'
import { listAccounts } from '../lib/accounts.js'
import { createTransaction, updateTransaction, recentDescriptions } from '../lib/transactions.js'
import CategorySelect from './CategorySelect.jsx'
import Icon from './Icon.jsx'

const TABS = [
  { kind: 'egreso',        label: 'Gasto' },
  { kind: 'ingreso',       label: 'Ingreso' },
  { kind: 'transferencia', label: 'Transferencia' }
]

// Guarda en el navegador la última cuenta usada por tipo de movimiento,
// para no tener que elegirla cada vez. Si falla, no pasa nada.
function recordarCuenta(kind, id) {
  try { window.localStorage.setItem(`ultima_cuenta_${kind}`, id) } catch {}
}
function cuentaRecordada(kind) {
  try { return window.localStorage.getItem(`ultima_cuenta_${kind}`) } catch { return null }
}

// tx: movimiento a editar. plantilla: movimiento a repetir (se crea uno
// nuevo con sus datos y la fecha de hoy).
export default function TransactionForm({ tx, plantilla, onDone, onSavedAndNext, onCancel }) {
  const base = tx ?? plantilla
  const vacio = (kind = 'egreso', extra = {}) => ({
    kind,
    amount: '',
    occurred_on: todayISO(),
    account_id: '',
    to_account_id: '',
    category_id: '',
    description: '',
    note: '',
    ...extra
  })

  const [v, setV] = useState(() => base ? {
    kind: base.kind,
    amount: String(base.amount ?? ''),
    occurred_on: tx ? base.occurred_on : todayISO(),
    account_id: base.account_id ?? '',
    to_account_id: base.to_account_id ?? '',
    category_id: base.category_id ?? '',
    description: base.description ?? '',
    note: base.note ?? ''
  } : vacio())
  const [accounts, setAccounts] = useState([])
  const [sugerencias, setSugerencias] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [verMas, setVerMas] = useState(!!base?.note || (tx && tx.occurred_on !== todayISO()))

  const esTransferencia = v.kind === 'transferencia'
  const set = (k) => (e) => setV(prev => ({ ...prev, [k]: e.target.value }))

  useEffect(() => {
    listAccounts()
      .then(list => {
        setAccounts(list)
        if (base) return
        const recordada = cuentaRecordada(v.kind)
        const existe = list.some(a => a.id === recordada)
        setV(prev => ({
          ...prev,
          account_id: existe ? recordada : (list[0]?.id ?? '')
        }))
      })
      .catch(e => setError(e.message))
    recentDescriptions().then(setSugerencias).catch(() => {})
  }, [])

  const propias = useMemo(
    () => sugerencias.filter(s => s.kind === v.kind),
    [sugerencias, v.kind]
  )

  function cambiarTipo(kind) {
    const recordada = cuentaRecordada(kind)
    const existe = accounts.some(a => a.id === recordada)
    setV(prev => ({
      ...prev,
      kind,
      category_id: '',
      to_account_id: '',
      account_id: existe ? recordada : prev.account_id
    }))
    setError('')
  }

  // Al escribir un concepto ya usado, propone su categoría (y su cuenta
  // si todavía no se tocó nada).
  function cambiarConcepto(e) {
    const description = e.target.value
    const previo = propias.find(s => s.description.trim().toLowerCase() === description.trim().toLowerCase())
    setV(prev => ({
      ...prev,
      description,
      category_id: previo && !prev.category_id && previo.category_id ? previo.category_id : prev.category_id
    }))
  }

  const monto = parseAmount(v.amount)
  const esCuenta = isExpression(v.amount)
  const cuentaOrigen = accounts.find(a => a.id === v.account_id)

  function validar() {
    if (!v.account_id) return 'Elige una cuenta'
    if (!(monto > 0)) return 'El monto tiene que ser un número mayor que cero'
    if (!v.occurred_on) return 'Elige la fecha'
    if (esTransferencia && !v.to_account_id) return 'Elige la cuenta de destino'
    if (esTransferencia && v.account_id === v.to_account_id) return 'Las dos cuentas deben ser distintas'
    return ''
  }

  async function save(siguiente = false) {
    const msg = validar()
    if (msg) { setError(msg); return }

    setBusy(true); setError('')
    try {
      const valores = { ...v, amount: monto }
      if (tx) await updateTransaction(tx.id, valores)
      else await createTransaction(valores)
      recordarCuenta(v.kind, v.account_id)
      if (siguiente) {
        // Mantiene tipo, cuenta y fecha: lo típico al pasar varios tickets.
        setV(prev => vacio(prev.kind, { account_id: prev.account_id, occurred_on: prev.occurred_on }))
        setBusy(false)
        onSavedAndNext?.()
        document.getElementById('amount')?.focus()
      } else {
        onDone(tx ? 'Cambios guardados' : 'Movimiento registrado')
      }
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
          {tx ? 'Editar movimiento' : plantilla ? 'Repetir movimiento' : 'Nuevo movimiento'}
        </span>
      </div>

      <div className="seg">
        {TABS.map(t => (
          <button key={t.kind} className={v.kind === t.kind ? 'on' : ''} onClick={() => cambiarTipo(t.kind)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card stack">
        <div>
          <label htmlFor="amount">Monto</label>
          <input
            id="amount" type="text" inputMode="decimal"
            className={'input-amount ' + (v.kind === 'ingreso' ? 'pos' : '')}
            value={v.amount} onChange={set('amount')}
            onKeyDown={e => { if (e.key === 'Enter') save() }}
            placeholder="0.00"
            autoFocus={!tx}
            autoComplete="off"
          />
          {esCuenta ? (
            <p className={'hint num ' + (Number.isNaN(monto) ? 'neg' : '')}>
              {Number.isNaN(monto) ? 'La cuenta no se entiende' : `= ${money(monto)}`}
            </p>
          ) : (
            <p className="hint">Puedes escribir cuentas: 150+75, 3*45</p>
          )}
        </div>

        <div>
          <label htmlFor="desc">Concepto</label>
          <input
            id="desc" value={v.description} onChange={cambiarConcepto}
            placeholder={esTransferencia ? 'Traslado a efectivo' : v.kind === 'ingreso' ? 'Salario' : 'Supermercado'}
            list="conceptos" autoComplete="off"
          />
          <datalist id="conceptos">
            {propias.slice(0, 60).map(s => <option key={s.description} value={s.description} />)}
          </datalist>
        </div>

        {!esTransferencia && (
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
          <label htmlFor="acc">{esTransferencia ? 'Desde' : 'Cuenta'}</label>
          <select id="acc" value={v.account_id} onChange={set('account_id')}>
            <option value="">Elegir…</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.emoji} {a.name} · {money(a.balance)}</option>
            ))}
          </select>
          {cuentaOrigen && v.kind !== 'ingreso' && monto > 0 && cuentaOrigen.type !== 'tarjeta'
            && Number(cuentaOrigen.balance) - monto < 0 && !tx && (
            <p className="hint warn">Esta cuenta quedaría en {money(Number(cuentaOrigen.balance) - monto)}.</p>
          )}
        </div>

        {esTransferencia && (
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
            <p className="hint">
              Una transferencia no cuenta como gasto. El dinero solo cambia de lugar.
              Para abonar a una tarjeta, transfiere hacia ella.
            </p>
          </div>
        )}

        {!verMas ? (
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setVerMas(true)}>
            {v.occurred_on === todayISO() ? 'Hoy' : v.occurred_on} · Cambiar fecha o añadir nota
          </button>
        ) : (
          <>
            <div>
              <label htmlFor="date">Fecha</label>
              <div className="row" style={{ gap: 6 }}>
                <input id="date" type="date" className="grow" value={v.occurred_on} onChange={set('occurred_on')} />
                <button className="chip" onClick={() => setV(p => ({ ...p, occurred_on: todayISO() }))}>Hoy</button>
                <button className="chip" onClick={() => {
                  const d = new Date(); d.setDate(d.getDate() - 1)
                  const p2 = (x) => String(x).padStart(2, '0')
                  setV(p => ({ ...p, occurred_on: `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` }))
                }}>Ayer</button>
              </div>
            </div>
            <div>
              <label htmlFor="note">Nota</label>
              <textarea id="note" rows={2} value={v.note} onChange={set('note')} />
            </div>
          </>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <button className="btn btn-primary btn-block btn-lg" onClick={() => save(false)} disabled={busy}>
        {busy ? 'Guardando…' : tx ? 'Guardar cambios' : 'Registrar'}
      </button>

      {!tx && (
        <button className="btn btn-block" onClick={() => save(true)} disabled={busy}>
          Registrar y añadir otro
        </button>
      )}
    </div>
  )
}
