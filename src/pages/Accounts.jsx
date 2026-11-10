import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { money, shortDate, parseAmount, isExpression } from '../lib/format.js'
import {
  listAccounts, getAccount, typeLabel, esLiquida, esDeuda, adjustBalance,
  archiveAccount, unarchiveAccount, deleteAccount, ACCOUNT_TYPES
} from '../lib/accounts.js'
import { listAccountTransactions } from '../lib/transactions.js'
import { listPending } from '../lib/payments.js'
import AccountForm from '../components/AccountForm.jsx'
import DebtPayForm from '../components/DebtPayForm.jsx'
import Icon from '../components/Icon.jsx'
import { useToast } from '../components/Toast.jsx'

export default function Accounts() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // editing: null | { nuevo: tipo } | fila de la cuenta
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

  // Trae la fila real de accounts (la vista es un cálculo) y le suma el
  // saldo de hoy, que es lo que el formulario deja corregir.
  async function abrirEdicion(id) {
    setError('')
    try {
      const fila = await getAccount(id)
      const vista = items.find(a => a.id === id)
      setEditing({ ...fila, balance: vista?.balance ?? fila.initial_balance })
    } catch (e) {
      setError(e.message)
    }
  }

  if (editing) {
    const nuevo = editing.nuevo
    return (
      <AccountForm
        key={nuevo ?? editing.id}
        account={nuevo ? null : editing}
        tipo={nuevo}
        onDone={() => { setEditing(null); load(); toast(nuevo === 'prestamo' ? 'Préstamo registrado' : 'Cuenta guardada') }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  if (detalle) {
    const actual = items.find(a => a.id === detalle.id) ?? detalle
    return (
      <AccountDetail
        account={actual}
        accounts={items}
        onBack={() => setDetalle(null)}
        onEdit={() => abrirEdicion(actual.id)}
        onChanged={load}
      />
    )
  }

  const activos = items.filter(a => !a.archived)
  const suma = (l) => l.reduce((s, a) => s + Number(a.balance), 0)
  const total = suma(activos)
  const liquido = suma(activos.filter(a => esLiquida(a.type)))
  const enTarjetas = suma(activos.filter(a => a.type === 'tarjeta'))
  const enPrestamos = suma(activos.filter(a => a.type === 'prestamo'))

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
              <span className="num neg">{money(Math.abs(enTarjetas))}</span>
            </div>
          )}
          {enPrestamos < 0 && (
            <div className="between small" style={{ marginTop: 4 }}>
              <span className="muted">Deuda en préstamos</span>
              <span className="num neg">{money(Math.abs(enPrestamos))}</span>
            </div>
          )}
        </div>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-primary grow" onClick={() => setEditing({ nuevo: 'banco' })}>
          <Icon name="plus" size={18} /> Agregar cuenta
        </button>
        <button className="btn grow" onClick={() => setEditing({ nuevo: 'prestamo' })}>
          🏛️ Registrar préstamo
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="empty">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="list">
          <div className="empty">
            Todavía no tienes cuentas.<br />
            Agrega tu banco, tu efectivo, tus tarjetas y préstamos.
          </div>
        </div>
      ) : (
        grupos.map(g => {
          const subtotal = suma(g.cuentas.filter(a => !a.archived))
          return (
            <div key={g.value}>
              <div className="between">
                <div className="section-title">{g.label}</div>
                <span className={'small num ' + (esDeuda(g.value) ? 'neg' : 'faint')}
                      style={{ marginTop: 16, marginRight: 4 }}>
                  {esDeuda(g.value) ? `debes ${money(Math.abs(subtotal))}` : money(subtotal)}
                </span>
              </div>
              <div className="list" style={{ marginTop: 6 }}>
                {g.cuentas.map(a => (
                  <AccountRow key={a.id} account={a} onOpen={() => setDetalle(a)} />
                ))}
              </div>
            </div>
          )
        })
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

// Uso de una tarjeta (sobre su límite) o avance de un préstamo
// (sobre el monto original prestado).
function avance(a) {
  const debe = Math.max(0, -Number(a.balance))
  const tope = Number(a.credit_limit)
  if (!(tope > 0)) return null
  if (a.type === 'tarjeta') {
    return { tipo: 'tarjeta', debe, tope, disponible: tope - debe, pct: Math.round((debe / tope) * 100) }
  }
  if (a.type === 'prestamo') {
    const pagado = Math.max(0, tope - debe)
    return { tipo: 'prestamo', debe, tope, pagado, pct: Math.round((pagado / tope) * 100) }
  }
  return null
}

function AccountRow({ account: a, onOpen }) {
  const saldo = Number(a.balance)
  const deuda = esDeuda(a.type)
  const av = avance(a)

  let linea2 = typeLabel(a.type)
  if (av?.tipo === 'tarjeta') {
    linea2 = <><span className={av.pct >= 80 ? 'warn' : ''}>{av.pct}% usado</span> · {money(av.disponible)} disponible</>
  } else if (av?.tipo === 'prestamo') {
    linea2 = <><span className="pos">{av.pct}% pagado</span> de {money(av.tope)}</>
  }

  return (
    <button className="list-item" onClick={onOpen} style={{ opacity: a.archived ? 0.55 : 1 }}>
      <span className="avatar">{a.emoji}</span>
      <span className="grow">
        <span className="line-1">
          {a.name}
          {a.archived && <span className="faint small"> · archivada</span>}
        </span>
        <span className="line-2">{linea2}</span>
      </span>
      <span className={'figure-md num ' + (!deuda && saldo < 0 ? 'neg' : '')}>
        {money(deuda ? Math.abs(saldo) : saldo)}
      </span>
      <Icon name="chevron" size={16} className="faint" />
    </button>
  )
}

function AccountDetail({ account: a, accounts, onBack, onEdit, onChanged }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [movs, setMovs] = useState(null)
  const [cuotas, setCuotas] = useState([])
  const [error, setError] = useState('')
  const [ajustando, setAjustando] = useState(false)
  const [pagando, setPagando] = useState(false)
  const [real, setReal] = useState('')
  const [comoMovimiento, setComoMovimiento] = useState(false)
  const deuda = esDeuda(a.type)
  const av = avance(a)
  const saldo = Number(a.balance)

  async function cargar() {
    try {
      const [m, p] = await Promise.all([
        listAccountTransactions(a.id, 60),
        deuda ? listPending() : Promise.resolve([])
      ])
      setMovs(m)
      setCuotas(p.filter(x => x.target_account_id === a.id))
    } catch (e) { setError(e.message); setMovs([]) }
  }

  useEffect(() => { cargar() }, [a.id])

  if (pagando) {
    return (
      <DebtPayForm
        debt={a}
        payment={cuotas[0] ?? null}
        accounts={accounts}
        onCancel={() => setPagando(false)}
        onDone={(b) => {
          setPagando(false)
          toast(`Pago de ${money(b.total)} registrado`)
          onChanged(); cargar()
        }}
      />
    )
  }

  const realNum = parseAmount(real)
  const realFirmado = deuda ? -Math.abs(realNum) : realNum
  const dif = Number.isNaN(realNum) ? null : Math.round((realFirmado - saldo) * 100) / 100

  async function ajustar() {
    if (Number.isNaN(realNum)) { setError('Escribe el saldo real'); return }
    try {
      const d = await adjustBalance(a, realFirmado, { comoMovimiento })
      setAjustando(false); setReal(''); setError('')
      toast(d === 0 ? 'El saldo ya cuadraba' : 'Saldo actualizado')
      onChanged(); cargar()
    } catch (e) { setError(e.message) }
  }

  async function accion(fn, msg) {
    try { await fn(a.id); toast(msg); onChanged(); onBack() }
    catch (e) { setError(e.message) }
  }

  const proximaCuota = cuotas[0]

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
        <div className="figure-label" style={{ marginTop: 16 }}>{deuda ? 'Lo que debes hoy' : 'Saldo actual'}</div>
        <div className={'figure-xl num ' + (!deuda && saldo < 0 ? 'neg' : '')}>
          {money(deuda ? Math.abs(saldo) : saldo)}
        </div>
        {av && (
          <div style={{ marginTop: 10 }}>
            <div className="progress">
              <div style={{
                width: `${Math.min(100, av.pct)}%`,
                background: av.tipo === 'prestamo' ? 'var(--pos)' : av.pct >= 80 ? 'var(--warn)' : 'var(--accent)'
              }} />
            </div>
            <div className="between small faint" style={{ marginTop: 4 }}>
              {av.tipo === 'tarjeta' ? (
                <><span>{av.pct}% de {money(av.tope)}</span><span>{money(av.disponible)} disponible</span></>
              ) : (
                <><span>Pagado {money(av.pagado)} ({av.pct}%)</span><span>de {money(av.tope)}</span></>
              )}
            </div>
          </div>
        )}
        {deuda && (a.statement_day || a.due_day) && (
          <div className="small muted" style={{ marginTop: 8 }}>
            {a.statement_day && `Corte el día ${a.statement_day}`}
            {a.statement_day && a.due_day && ' · '}
            {a.due_day && `Pago el día ${a.due_day}`}
          </div>
        )}
        {proximaCuota && (
          <div className="small muted" style={{ marginTop: 6 }}>
            Próxima cuota: {money(proximaCuota.amount)} el {shortDate(proximaCuota.due_date)}
            {Number(proximaCuota.amount) > 0 && Math.abs(saldo) > 0 &&
              ` · ~${Math.ceil(Math.abs(saldo) / Number(proximaCuota.amount))} cuotas de capital restantes`}
          </div>
        )}
      </div>

      {deuda && Math.abs(saldo) > 0 && !ajustando && (
        <button className="btn btn-primary btn-block btn-lg" onClick={() => setPagando(true)}>
          {a.type === 'prestamo' ? 'Pagar cuota' : 'Pagar tarjeta'} · capital + intereses
        </button>
      )}

      {ajustando ? (
        <div className="card stack">
          <div>
            <label htmlFor="real">{deuda ? '¿Cuánto debes realmente hoy?' : '¿Cuánto tienes realmente hoy?'}</label>
            <input id="real" type="text" inputMode="decimal" className="input-amount" autoFocus
                   value={real} onChange={e => setReal(e.target.value)} placeholder={String(Math.abs(saldo))}
                   onKeyDown={e => e.key === 'Enter' && ajustar()} />
            {isExpression(real) && !Number.isNaN(realNum) && (
              <p className="hint num">= {money(realNum)}</p>
            )}
            {dif !== null && dif !== 0 && (
              <p className="hint">
                Diferencia: <b className="num">{dif > 0 ? '+' : '−'}{money(Math.abs(dif))}</b>
              </p>
            )}
          </div>

          <div className="seg">
            <button className={!comoMovimiento ? 'on' : ''} onClick={() => setComoMovimiento(false)}>
              Solo corregir saldo
            </button>
            <button className={comoMovimiento ? 'on' : ''} onClick={() => setComoMovimiento(true)}>
              Registrar como movimiento
            </button>
          </div>
          <p className="hint" style={{ marginTop: -4 }}>
            {comoMovimiento
              ? 'Se crea un ingreso o gasto "Ajuste de saldo" con fecha de hoy. Afecta tus reportes del mes.'
              : 'El saldo queda exacto sin crear ingresos ni gastos. Recomendado para corregir errores.'}
          </p>

          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost grow" onClick={() => { setAjustando(false); setError('') }}>Cancelar</button>
            <button className="btn btn-primary grow" onClick={ajustar}>Actualizar saldo</button>
          </div>
        </div>
      ) : (
        <>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn grow" onClick={() => setAjustando(true)}>Actualizar saldo</button>
            <button className="btn grow" onClick={() => navigate('/movimientos', {
              state: { nuevo: Date.now(), inicial: { kind: 'transferencia', account_id: deuda ? '' : a.id, to_account_id: deuda ? a.id : '' } }
            })}>
              Transferir
            </button>
            {deuda && (
              <button className="btn grow" onClick={() => navigate('/pagos', {
                state: { programar: { name: a.type === 'prestamo' ? `Cuota ${a.name}` : `Pago ${a.name}`, target_account_id: a.id, due_day: a.due_day } }
              })}>
                {cuotas.length ? 'Ver cuotas' : 'Programar cuotas'}
              </button>
            )}
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            {a.archived ? (
              <button className="btn btn-ghost grow" onClick={() => accion(unarchiveAccount, 'Cuenta restaurada')}>Restaurar</button>
            ) : (
              <button className="btn btn-ghost grow" onClick={() => accion(archiveAccount, 'Cuenta archivada')}>Archivar</button>
            )}
            <button className="btn btn-ghost neg grow" onClick={() => {
              if (confirm(`¿Borrar "${a.name}"? Solo se puede si no tiene movimientos.`)) {
                accion(deleteAccount, 'Cuenta borrada')
              }
            }}>Borrar</button>
          </div>
        </>
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
            // En una deuda, lo que "entra" es un abono (la deuda baja).
            const etiqueta = deuda ? (entra ? 'abono' : 'cargo') : null
            return (
              <div key={t.id} className="list-item" style={{ cursor: 'default' }}>
                <span className="avatar">{t.kind === 'transferencia' ? '🔄' : (t.category?.emoji ?? '📌')}</span>
                <span className="grow">
                  <span className="line-1">{titulo}</span>
                  <span className="line-2">
                    {shortDate(t.occurred_on)} · {etiqueta ?? (t.category?.name ?? (t.kind === 'transferencia' ? 'Transferencia' : 'Sin categoría'))}
                  </span>
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
