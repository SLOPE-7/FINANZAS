import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  money, shortDate, daysUntil, todayISO, parseAmount, isExpression,
  monthBounds, monthName, addMonthsISO, addDaysISO
} from '../lib/format.js'
import { listAccounts, esDeuda } from '../lib/accounts.js'
import {
  listPending, listHistory, committed, occurrencesBetween, RECURRENCES,
  markPaid, skipPayment, deletePayment
} from '../lib/payments.js'
import PaymentForm from '../components/PaymentForm.jsx'
import DebtPayForm from '../components/DebtPayForm.jsx'
import Icon from '../components/Icon.jsx'
import { useToast } from '../components/Toast.jsx'
import { estadoFecha } from './Dashboard.jsx'

const recLabel = (v) => RECURRENCES.find(r => r.value === v)?.label ?? ''
const DIAS_CORTOS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'deudas', label: 'Préstamos y tarjetas' },
  { value: 'fijos', label: 'Gastos fijos' },
  { value: 'ahorro', label: 'Ahorro' }
]

// Próxima fecha con ese día del mes (para programar cuotas de un préstamo).
function proximaFechaDia(dia) {
  const hoy = todayISO()
  if (!dia) return hoy
  const p = (x) => String(x).padStart(2, '0')
  const [y, m] = hoy.split('-').map(Number)
  const enMes = (yy, mm) => {
    const ultimo = new Date(yy, mm, 0).getDate()
    return `${yy}-${p(mm)}-${p(Math.min(dia, ultimo))}`
  }
  const este = enMes(y, m)
  if (este >= hoy) return este
  const sig = addMonthsISO(`${y}-${p(m)}-01`, 1)
  return enMes(Number(sig.slice(0, 4)), Number(sig.slice(5, 7)))
}

export default function Payments() {
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [pendientes, setPendientes] = useState([])
  const [historial, setHistorial] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [defaults, setDefaults] = useState(null)
  const [paying, setPaying] = useState(null)
  const [vista, setVista] = useState('lista')
  const [filtro, setFiltro] = useState('todos')
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

  // Desde el detalle de un préstamo: "Programar cuotas".
  useEffect(() => {
    const prog = location.state?.programar
    if (!prog) return
    setDefaults({
      name: prog.name,
      target_account_id: prog.target_account_id,
      due_date: proximaFechaDia(prog.due_day)
    })
    setEditing('new')
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state])

  const cuentaDe = (id) => accounts.find(a => a.id === id)
  const tipoDe = (p) => {
    const t = cuentaDe(p.target_account_id)
    if (t && esDeuda(t.type)) return 'deudas'
    if (t) return 'ahorro'
    return 'fijos'
  }

  const filtrados = useMemo(
    () => filtro === 'todos' ? pendientes : pendientes.filter(p => tipoDe(p) === filtro),
    [pendientes, filtro, accounts]
  )

  if (editing) {
    return (
      <PaymentForm
        payment={editing === 'new' ? null : editing}
        defaults={editing === 'new' ? defaults : null}
        onDone={() => { setEditing(null); setDefaults(null); load(); toast('Pago guardado') }}
        onCancel={() => { setEditing(null); setDefaults(null) }}
      />
    )
  }

  if (paying) {
    const destino = cuentaDe(paying.target_account_id)
    // Préstamos y tarjetas: desglose capital + intereses.
    if (destino && esDeuda(destino.type)) {
      return (
        <DebtPayForm
          debt={destino}
          payment={paying}
          accounts={accounts}
          onCancel={() => setPaying(null)}
          onDone={(b) => { setPaying(null); load(); toast(`Pago de ${money(b.total)} registrado`) }}
        />
      )
    }
    return (
      <PayDialog
        payment={paying}
        accounts={accounts}
        onDone={() => { setPaying(null); load(); toast('Pago registrado') }}
        onCancel={() => setPaying(null)}
      />
    )
  }

  const { total, vencido } = committed(filtrados)

  // Resumen del mes en curso: lo que se pagó y lo que falta.
  const { from: iniMes, to: finMes } = monthBounds(todayISO())
  const pagadoMes = historial
    .filter(h => h.status === 'pagado' && h.due_date >= iniMes && h.due_date <= finMes)
    .filter(h => filtro === 'todos' || tipoDe(h) === filtro)
    .reduce((s, h) => s + Number(h.amount), 0)
  const pendienteMes = occurrencesBetween(filtrados, '0000-01-01', finMes)
    .reduce((s, o) => s + Number(o.pago.amount), 0)
  const totalMes = pagadoMes + pendienteMes
  const pctMes = totalMes > 0 ? Math.round((pagadoMes / totalMes) * 100) : 0

  // Agrupa por urgencia.
  const grupos = [
    { titulo: 'Vencidos', items: [] },
    { titulo: 'Esta semana', items: [] },
    { titulo: 'Próximos 30 días', items: [] },
    { titulo: 'Más adelante', items: [] }
  ]
  for (const p of filtrados) {
    const d = daysUntil(p.due_date)
    grupos[d < 0 ? 0 : d <= 7 ? 1 : d <= 30 ? 2 : 3].items.push(p)
  }

  const acciones = (p) => ({
    onPay: () => setPaying(p),
    onEdit: () => setEditing(p),
    onSkip: async () => {
      if (!confirm(`¿Omitir "${p.name}" esta vez? No se registrará nada.`)) return
      try { await skipPayment(p.id); load(); toast('Pago omitido') }
      catch (e) { setError(e.message) }
    },
    onDelete: async () => {
      if (!confirm(`¿Borrar "${p.name}" y su recurrencia?`)) return
      try { await deletePayment(p.id); load(); toast('Pago borrado') }
      catch (e) { setError(e.message) }
    }
  })

  return (
    <div className="page stack">
      <div className="card-hero">
        <div className="figure-label">Comprometido en 30 días</div>
        <div className="figure-xl num warn">{money(total)}</div>
        {vencido > 0 && (
          <div className="badge neg" style={{ marginTop: 8 }}>{money(vencido)} ya vencido</div>
        )}
        {totalMes > 0 && (
          <div className="divider">
            <div className="between small">
              <span className="muted">
                Pagado en {monthName(Number(iniMes.slice(5, 7)))}
              </span>
              <span className="num pos">{money(pagadoMes)}</span>
            </div>
            <div className="between small" style={{ marginTop: 2 }}>
              <span className="muted">Falta (incluye vencidos)</span>
              <span className="num">{money(pendienteMes)}</span>
            </div>
            <div className="progress" style={{ marginTop: 8 }}>
              <div style={{ width: `${pctMes}%`, background: 'var(--pos)' }} />
            </div>
            <div className="small faint" style={{ marginTop: 4 }}>{pctMes}% de los pagos del mes</div>
          </div>
        )}
      </div>

      <button className="btn btn-primary btn-block" onClick={() => setEditing('new')}>
        <Icon name="plus" size={18} /> Programar pago
      </button>

      <div className="seg">
        <button className={vista === 'lista' ? 'on' : ''} onClick={() => setVista('lista')}>Lista</button>
        <button className={vista === 'calendario' ? 'on' : ''} onClick={() => setVista('calendario')}>Calendario</button>
      </div>

      <div className="chips">
        {FILTROS.map(f => (
          <button key={f.value} className={'chip' + (filtro === f.value ? ' on' : '')}
                  onClick={() => setFiltro(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="empty">Cargando…</div>
      ) : vista === 'calendario' ? (
        <Calendario
          pendientes={filtrados}
          historial={historial.filter(h => filtro === 'todos' || tipoDe(h) === filtro)}
          renderRow={(p) => (
            <PendingRow key={p.id} payment={p} destino={cuentaDe(p.target_account_id)} {...acciones(p)} />
          )}
        />
      ) : filtrados.length === 0 ? (
        <div className="list">
          <div className="empty">
            {filtro === 'todos'
              ? <>No tienes pagos programados.<br />Agrega el alquiler, la energía, el internet o las cuotas de un préstamo.</>
              : 'No hay pagos en este filtro.'}
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
                <PendingRow key={p.id} payment={p} destino={cuentaDe(p.target_account_id)} {...acciones(p)} />
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

function Calendario({ pendientes, historial, renderRow }) {
  const hoy = todayISO()
  const [mes, setMes] = useState(hoy.slice(0, 7) + '-01')
  const [dia, setDia] = useState(hoy)
  const { from, to } = monthBounds(mes)
  const [y, m] = mes.split('-').map(Number)

  const porDia = useMemo(() => {
    const mapa = new Map()
    const add = (fecha, x) => { if (!mapa.has(fecha)) mapa.set(fecha, []); mapa.get(fecha).push(x) }
    for (const o of occurrencesBetween(pendientes, from, to)) add(o.fecha, { ...o, estado: 'pendiente' })
    for (const h of historial) {
      if (h.status === 'pagado' && h.due_date >= from && h.due_date <= to) add(h.due_date, { fecha: h.due_date, pago: h, estado: 'pagado' })
    }
    return mapa
  }, [pendientes, historial, from, to])

  // Rejilla que empieza en lunes.
  const primero = new Date(y, m - 1, 1).getDay()
  const vacios = (primero + 6) % 7
  const dias = Number(to.slice(8, 10))
  const celdas = [...Array(vacios).fill(null), ...Array.from({ length: dias }, (_, i) => addDaysISO(from, i))]
  const totalMes = [...porDia.values()].flat()
    .filter(x => x.estado === 'pendiente').reduce((s, x) => s + Number(x.pago.amount), 0)

  const delDia = porDia.get(dia) ?? []

  return (
    <div className="stack">
      <div className="card">
        <div className="between" style={{ marginBottom: 10 }}>
          <button className="icon-btn" onClick={() => setMes(addMonthsISO(mes, -1))} aria-label="Mes anterior">
            <Icon name="back" />
          </button>
          <div className="center">
            <div style={{ fontWeight: 650, textTransform: 'capitalize' }}>{monthName(m)} {y}</div>
            <div className="small faint">Por pagar {money(totalMes)}</div>
          </div>
          <button className="icon-btn" onClick={() => setMes(addMonthsISO(mes, 1))} aria-label="Mes siguiente">
            <Icon name="chevron" />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {DIAS_CORTOS.map((d, i) => (
            <div key={i} className="small faint center" style={{ paddingBottom: 4 }}>{d}</div>
          ))}
          {celdas.map((f, i) => {
            if (!f) return <div key={'v' + i} />
            const items = porDia.get(f) ?? []
            const pend = items.filter(x => x.estado === 'pendiente')
            const vencido = pend.length > 0 && f < hoy
            const pagado = items.length > 0 && pend.length === 0
            const color = vencido ? 'var(--neg)' : pagado ? 'var(--pos)' : pend.length ? 'var(--warn)' : null
            const sel = f === dia
            return (
              <button
                key={f}
                onClick={() => setDia(f)}
                aria-label={`${Number(f.slice(8))}: ${items.length} pagos`}
                style={{
                  aspectRatio: '1', border: f === hoy ? '1.5px solid var(--text)' : '1px solid transparent',
                  borderRadius: 10, cursor: 'pointer', font: 'inherit', color: 'var(--text)',
                  background: sel ? 'var(--surface-2)' : 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3
                }}
              >
                <span style={{ fontSize: 14, fontWeight: sel || f === hoy ? 700 : 400 }}>{Number(f.slice(8))}</span>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: color ?? 'transparent' }} />
              </button>
            )
          })}
        </div>

        <div className="row small faint" style={{ gap: 12, marginTop: 10, justifyContent: 'center' }}>
          <span><Punto c="var(--warn)" />Pendiente</span>
          <span><Punto c="var(--neg)" />Vencido</span>
          <span><Punto c="var(--pos)" />Pagado</span>
        </div>
      </div>

      <div className="section-title">{shortDate(dia)}{dia === hoy ? ' · hoy' : ''}</div>
      {delDia.length === 0 ? (
        <div className="list"><div className="empty">Nada programado este día.</div></div>
      ) : (
        <div className="list">
          {delDia.map((x, i) => x.estado === 'pagado' ? (
            <div key={'h' + i} className="list-item" style={{ cursor: 'default' }}>
              <span className="avatar">✅</span>
              <span className="grow"><span className="line-1">{x.pago.name}</span><span className="line-2">pagado</span></span>
              <span className="figure-md num faint">{money(x.pago.amount)}</span>
            </div>
          ) : x.primera ? (
            renderRow(x.pago)
          ) : (
            // Repetición futura: todavía no se puede pagar, solo se muestra.
            <div key={'r' + i} className="list-item" style={{ cursor: 'default' }}>
              <span className="avatar">🔁</span>
              <span className="grow">
                <span className="line-1">{x.pago.name}</span>
                <span className="line-2">{recLabel(x.pago.recurrence).toLowerCase()} · se podrá pagar cuando llegue</span>
              </span>
              <span className="figure-md num">{money(x.pago.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Punto({ c }) {
  return <i style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: c, marginRight: 4 }} />
}

function PendingRow({ payment: p, destino, onPay, onEdit, onSkip, onDelete }) {
  const [open, setOpen] = useState(false)
  const { texto, clase } = estadoFecha(p.due_date)
  const rec = p.recurrence && p.recurrence !== 'ninguna' ? recLabel(p.recurrence).toLowerCase() : ''
  const deuda = destino && esDeuda(destino.type)
  const debe = deuda ? Math.abs(Number(destino.balance)) : 0
  const cuotas = deuda && Number(p.amount) > 0 ? Math.ceil(debe / Number(p.amount)) : null

  let extra = ''
  if (deuda) extra = `faltan ${money(debe)}${cuotas ? ` · ~${cuotas} cuotas` : ''}`
  else if (destino) extra = `llevas ${money(Math.abs(Number(destino.balance)))}`

  return (
    <>
      <div className="list-item" onClick={() => setOpen(v => !v)} role="button" aria-expanded={open}>
        <span className="avatar">{p.target?.emoji ?? p.category?.emoji ?? '📅'}</span>
        <span className="grow">
          <span className="line-1">{p.name}</span>
          <span className="line-2">
            <span className={clase}>{texto}</span>
            {rec && ` · ${rec}`}
          </span>
          {extra && <span className="line-2">{extra}</span>}
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
              Abona a {destino.emoji} {destino.name} · llevas {saldoDestino}
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
            Si pagaste más o menos, corrígelo aquí.
          </p>
        </div>

        <div>
          <label htmlFor="cuenta">Salió de</label>
          <select id="cuenta" value={accountId} onChange={e => setAccountId(e.target.value)}>
            <option value="">Elegir…</option>
            {accounts
              .filter(a => a.id !== p.target_account_id && !esDeuda(a.type))
              .map(a => (
                <option key={a.id} value={a.id}>{a.emoji} {a.name} · {money(a.balance)}</option>
              ))}
            {accounts
              .filter(a => a.type === 'tarjeta' && a.id !== p.target_account_id)
              .map(a => (
                <option key={a.id} value={a.id}>{a.emoji} {a.name} (tarjeta)</option>
              ))}
          </select>
          {origen && !esDeuda(origen.type) && Number(origen.balance) < (parseAmount(amount) || 0) && (
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
