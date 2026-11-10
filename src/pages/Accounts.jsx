import { useEffect, useState } from 'react'
import { money, shortDate, parseAmount, isExpression } from '../lib/format.js'
import {
  listAccounts, getAccount, typeLabel, esLiquida, adjustBalance,
  archiveAccount, unarchiveAccount, deleteAccount, ACCOUNT_TYPES
} from '../lib/accounts.js'
import { listAccountTransactions } from '../lib/transactions.js'
import AccountForm from '../components/AccountForm.jsx'
import Icon from '../components/Icon.jsx'
import { useToast } from '../components/Toast.jsx'

export default function Accounts() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [showArchived, setShowArchived] = useState(false)

  async function load() {
    setLoading(true); setError('')
    try {
      setItems(await listAccounts({ includeArchived: showArchived }))
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [showArchived])

  // Trae la fila real de accounts, no la de la vista: la vista es
  // un cálculo y no sirve para rellenar el formulario de edición.
  async function abrirEdicion(id) {
    setError('')
    try {
      setEditing(await getAccount(id))
    } catch (e) {
      setError(e.message)
    }
  }

  if (editing) {
    return (
      <AccountForm
        account={editing === 'new' ? null : editing}
        onDone={() => { setEditing(null); setDetalle(null); load(); toast('Cuenta guardada') }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  if (detalle) {
    const actual = items.find(a => a.id === detalle.id) ?? detalle
    return (
      <AccountDetail
        account={actual}
        onBack={() => setDetalle(null)}
        onEdit={() => abrirEdicion(actual.id)}
        onChanged={load}
      />
    )
  }

  const activos = items.filter(a => !a.archived)
  const total = activos.reduce((s, a) => s + Number(a.balance), 0)
  const liquido = activos.filter(a => esLiquida(a.type)).reduce((s, a) => s + Number(a.balance), 0)
  const enTarjetas = activos
    .filter(a => a.type === 'tarjeta')
    .reduce((s, a) => s + Number(a.balance), 0)

  // Agrupa por tipo, en el orden de ACCOUNT_TYPES.
  const grupos = ACCOUNT_TYPES
    .map(t => ({ ...t, cuentas: items.filter(a => a.type === t.value) }))
    .filter(g => g.cuentas.length > 0)

  return (
    <div className="page stack">
      <div className="card-hero">
        <div className="figure-label">Patrimonio neto</div>
        <div className={'figure-xl num ' + (total < 0 ? 'neg' : '')}>
          {money(total)}
        </div>
        <div className="divider">
          <div className="between small">
            <span className="muted">A mano (bancos, efectivo)</span>
            <span className="num">{money(liquido)}</span>
          </div>
          {enTarjetas < 0 && (
            <div className="between small" style={{ marginTop: 4 }}>
              <span className="muted">Deuda en tarjetas</span>
              <span className="num neg">{money(enTarjetas)}</span>
            </div>
          )}
        </div>
      </div>

      <button className="btn btn-primary btn-block" onClick={() => setEditing('new')}>
        <Icon name="plus" size={18} /> Agregar cuenta
      </button>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="empty">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="list">
          <div className="empty">
            Todavía no tienes cuentas.<br />
            Agrega tu banco, tu efectivo y tus tarjetas.
          </div>
        </div>
      ) : (
        grupos.map(g => (
          <div key={g.value}>
            <div className="between">
              <div className="section-title">{g.label}</div>
              <span className="small faint num" style={{ marginTop: 16, marginRight: 4 }}>
                {money(g.cuentas.filter(a => !a.archived).reduce((s, a) => s + Number(a.balance), 0))}
              </span>
            </div>
            <div className="list" style={{ marginTop: 6 }}>
              {g.cuentas.map(a => (
                <AccountRow key={a.id} account={a} onOpen={() => setDetalle(a)} />
              ))}
            </div>
          </div>
        ))
      )}

      <button
        className="btn btn-ghost btn-block"
        onClick={() => setShowArchived(v => !v)}
      >
        {showArchived ? 'Ocultar archivadas' : 'Ver archivadas'}
      </button>
    </div>
  )
}

function usoTarjeta(a) {
  const saldo = Number(a.balance)
  if (a.type !== 'tarjeta' || !(Number(a.credit_limit) > 0)) return null
  const usado = Math.max(0, -saldo)
  const limite = Number(a.credit_limit)
  return { usado, limite, disponible: limite - usado, pct: Math.round((usado / limite) * 100) }
}

function AccountRow({ account: a, onOpen }) {
  const saldo = Number(a.balance)
  const uso = usoTarjeta(a)

  return (
    <button className="list-item" onClick={onOpen} style={{ opacity: a.archived ? 0.55 : 1 }}>
      <span className="avatar">{a.emoji}</span>
      <span className="grow">
        <span className="line-1">
          {a.name}
          {a.archived && <span className="faint small"> · archivada</span>}
        </span>
        {uso ? (
          <span className="line-2">
            <span className={uso.pct >= 80 ? 'warn' : ''}>{uso.pct}% usado</span>
            {' · '}{money(uso.disponible)} disponible
          </span>
        ) : (
          <span className="line-2">{typeLabel(a.type)}</span>
        )}
      </span>
      <span className={'figure-md num ' + (saldo < 0 && a.type !== 'tarjeta' ? 'neg' : '')}>
        {money(saldo)}
      </span>
      <Icon name="chevron" size={16} className="faint" />
    </button>
  )
}

function AccountDetail({ account: a, onBack, onEdit, onChanged }) {
  const toast = useToast()
  const [movs, setMovs] = useState(null)
  const [error, setError] = useState('')
  const [ajustando, setAjustando] = useState(false)
  const [real, setReal] = useState('')
  const esTarjeta = a.type === 'tarjeta'
  const uso = usoTarjeta(a)

  async function cargar() {
    try { setMovs(await listAccountTransactions(a.id, 60)) }
    catch (e) { setError(e.message); setMovs([]) }
  }

  useEffect(() => { cargar() }, [a.id])

  async function ajustar() {
    const n = parseAmount(real)
    if (Number.isNaN(n)) { setError('Escribe el saldo real'); return }
    try {
      // En tarjetas se escribe la deuda en positivo.
      const dif = await adjustBalance(a, esTarjeta ? -Math.abs(n) : n)
      setAjustando(false); setReal('')
      toast(dif === 0 ? 'El saldo ya cuadraba' : `Ajustado ${dif > 0 ? '+' : '−'}${money(Math.abs(dif))}`)
      onChanged(); cargar()
    } catch (e) { setError(e.message) }
  }

  async function accion(fn, msg) {
    try { await fn(a.id); toast(msg); onChanged(); onBack() }
    catch (e) { setError(e.message) }
  }

  return (
    <div className="page stack">
      <div className="between">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          <Icon name="back" size={18} /> Cuentas
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>Editar</button>
      </div>

      <div className="card-hero">
        <div className="row">
          <span className="avatar" style={{ width: 44, height: 44, fontSize: 22 }}>{a.emoji}</span>
          <div className="grow">
            <div style={{ fontWeight: 650, fontSize: 17 }}>{a.name}</div>
            <div className="small faint">{typeLabel(a.type)}{a.archived ? ' · archivada' : ''}</div>
          </div>
        </div>
        <div className="figure-label" style={{ marginTop: 16 }}>{esTarjeta ? 'Deuda actual' : 'Saldo actual'}</div>
        <div className={'figure-xl num ' + (!esTarjeta && Number(a.balance) < 0 ? 'neg' : '')}>
          {money(esTarjeta ? Math.abs(Number(a.balance)) : a.balance)}
        </div>
        {uso && (
          <div style={{ marginTop: 10 }}>
            <div className="progress">
              <div style={{ width: `${Math.min(100, uso.pct)}%`,
                            background: uso.pct >= 80 ? 'var(--warn)' : 'var(--accent)' }} />
            </div>
            <div className="between small faint" style={{ marginTop: 4 }}>
              <span>{uso.pct}% de {money(uso.limite)}</span>
              <span>{money(uso.disponible)} disponible</span>
            </div>
          </div>
        )}
        {esTarjeta && (a.statement_day || a.due_day) && (
          <div className="small muted" style={{ marginTop: 8 }}>
            {a.statement_day && `Corte el día ${a.statement_day}`}
            {a.statement_day && a.due_day && ' · '}
            {a.due_day && `Pago el día ${a.due_day}`}
          </div>
        )}
      </div>

      {ajustando ? (
        <div className="card stack">
          <div>
            <label htmlFor="real">{esTarjeta ? '¿Cuánto debes realmente hoy?' : '¿Cuánto tienes realmente hoy?'}</label>
            <input id="real" type="text" inputMode="decimal" className="input-amount" autoFocus
                   value={real} onChange={e => setReal(e.target.value)} placeholder="0.00"
                   onKeyDown={e => e.key === 'Enter' && ajustar()} />
            <p className="hint">
              {isExpression(real) && !Number.isNaN(parseAmount(real)) ? `= ${money(parseAmount(real))}. ` : ''}
              Se registra la diferencia como "Ajuste de saldo" con fecha de hoy.
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost grow" onClick={() => { setAjustando(false); setError('') }}>Cancelar</button>
            <button className="btn btn-primary grow" onClick={ajustar}>Ajustar</button>
          </div>
        </div>
      ) : (
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn grow" onClick={() => setAjustando(true)}>Ajustar saldo</button>
          {a.archived ? (
            <button className="btn grow" onClick={() => accion(unarchiveAccount, 'Cuenta restaurada')}>Restaurar</button>
          ) : (
            <button className="btn grow" onClick={() => accion(archiveAccount, 'Cuenta archivada')}>Archivar</button>
          )}
          <button className="btn btn-ghost neg" onClick={() => {
            if (confirm(`¿Borrar "${a.name}"? Solo se puede si no tiene movimientos.`)) {
              accion(deleteAccount, 'Cuenta borrada')
            }
          }}>Borrar</button>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <div className="section-title">Últimos movimientos</div>
      {movs === null ? (
        <div className="empty">Cargando…</div>
      ) : movs.length === 0 ? (
        <div className="list"><div className="empty">Esta cuenta no tiene movimientos.</div></div>
      ) : (
        <div className="list">
          {movs.map(t => {
            // Desde el punto de vista de esta cuenta: ¿entra o sale?
            const entra = t.kind === 'ingreso' || (t.kind === 'transferencia' && t.to_account_id === a.id)
            const titulo = t.description ||
              (t.kind === 'transferencia'
                ? (entra ? `Desde ${t.account?.name ?? '?'}` : `Hacia ${t.destino?.name ?? '?'}`)
                : 'Sin concepto')
            return (
              <div key={t.id} className="list-item" style={{ cursor: 'default' }}>
                <span className="avatar">{t.kind === 'transferencia' ? '🔄' : (t.category?.emoji ?? '📌')}</span>
                <span className="grow">
                  <span className="line-1">{titulo}</span>
                  <span className="line-2">{shortDate(t.occurred_on)} · {t.category?.name ?? (t.kind === 'transferencia' ? 'Transferencia' : 'Sin categoría')}</span>
                </span>
                <span className={'figure-md num ' + (entra ? 'pos' : '')}>
                  {entra ? '+' : '−'}{money(t.amount)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
