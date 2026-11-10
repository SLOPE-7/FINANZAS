import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { money, shortDate, todayISO, monthName, addMonthsISO } from '../lib/format.js'
import {
  listTransactions, monthTotals, deleteTransaction, toCSV, downloadFile, exportName
} from '../lib/transactions.js'
import TransactionForm from '../components/TransactionForm.jsx'
import Receipt from '../components/Receipt.jsx'
import Icon from '../components/Icon.jsx'
import { useToast } from '../components/Toast.jsx'

const FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'egreso', label: 'Gastos' },
  { value: 'ingreso', label: 'Ingresos' },
  { value: 'transferencia', label: 'Transferencias' }
]

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export default function Transactions() {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()

  const [month, setMonth] = useState(todayISO().slice(0, 7) + '-01')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // editing: null | 'new' | tx (editar) | { plantilla } (repetir)
  const [editing, setEditing] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [texto, setTexto] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [buscando, setBuscando] = useState(false)

  // Cada carga lleva un número; si el usuario cambia de mes rápido,
  // una respuesta vieja que llega tarde no pisa la del mes actual.
  const ultimaCarga = useRef(0)

  async function load() {
    const id = ++ultimaCarga.current
    setLoading(true); setError('')
    try {
      const data = await listTransactions({ month })
      if (id === ultimaCarga.current) setItems(data)
    } catch (e) {
      if (id === ultimaCarga.current) setError(e.message)
    }
    if (id === ultimaCarga.current) setLoading(false)
  }

  useEffect(() => { load() }, [month])

  // El botón "+" de la barra inferior y "Exportar" de Más llegan aquí.
  useEffect(() => {
    const st = location.state
    if (!st) return
    if (st.nuevo) { setReceipt(null); setEditing(st.inicial ? { plantilla: st.inicial } : 'new') }
    if (st.exportar) setBuscando(true)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state])

  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase()
    return items.filter(t => {
      if (filtro !== 'todos' && t.kind !== filtro) return false
      if (!q) return true
      return [t.description, t.note, t.category?.name, t.account?.name, t.destino?.name, String(t.amount)]
        .some(x => x && String(x).toLowerCase().includes(q))
    })
  }, [items, texto, filtro])

  function moverMes(delta) {
    setMonth(m => addMonthsISO(m, delta))
  }

  function exportar() {
    if (visibles.length === 0) { toast('No hay movimientos para exportar'); return }
    downloadFile(exportName(month), toCSV(visibles))
    toast(`${visibles.length} movimientos exportados`)
  }

  if (receipt) {
    return <Receipt tx={receipt} onClose={() => setReceipt(null)} />
  }

  if (editing) {
    const esPlantilla = editing !== 'new' && editing.plantilla
    return (
      <TransactionForm
        tx={editing === 'new' || esPlantilla ? null : editing}
        plantilla={esPlantilla ? editing.plantilla : null}
        onDone={(msg) => {
          setEditing(null); load()
          toast(msg || 'Movimiento guardado')
        }}
        onSavedAndNext={() => { load(); toast('Guardado. Registra el siguiente.') }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  const { ingresos, egresos, balance } = monthTotals(visibles)
  const [ay, am] = month.split('-').map(Number)
  const grupos = agrupar(visibles)
  const filtrando = texto.trim() || filtro !== 'todos'
  const esMesActual = month.slice(0, 7) === todayISO().slice(0, 7)

  return (
    <div className="page stack">
      <div className="between">
        <button className="icon-btn" onClick={() => moverMes(-1)} aria-label="Mes anterior">
          <Icon name="back" />
        </button>
        <button className="btn btn-ghost" style={{ fontSize: 15, fontWeight: 650, textTransform: 'capitalize' }}
                onClick={() => setMonth(todayISO().slice(0, 7) + '-01')}
                title="Volver al mes actual">
          {monthName(am)} {ay}{!esMesActual && <span className="faint small"> · hoy</span>}
        </button>
        <button className="icon-btn" onClick={() => moverMes(1)} aria-label="Mes siguiente">
          <Icon name="chevron" />
        </button>
      </div>

      <div className="card">
        <div className="between" style={{ marginBottom: 10 }}>
          <div>
            <div className="figure-label">Ingresos</div>
            <div className="figure-md num pos">{money(ingresos)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="figure-label">Gastos</div>
            <div className="figure-md num neg">{money(egresos)}</div>
          </div>
        </div>
        <div className="divider" style={{ marginTop: 0 }}>
          <div className="figure-label">{filtrando ? 'Balance filtrado' : 'Balance del mes'}</div>
          <div className={'figure-lg num ' + (balance < 0 ? 'neg' : 'pos')}>
            {money(balance)}
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <div className="search grow">
          <Icon name="search" size={18} />
          <input
            type="search" placeholder="Buscar concepto, categoría, monto…"
            value={texto} onChange={e => setTexto(e.target.value)}
          />
        </div>
        <button className={'icon-btn' + (buscando ? ' on' : '')} style={{ width: 44, height: 44 }}
                onClick={() => setBuscando(v => !v)} aria-label="Exportar">
          <Icon name="download" size={20} />
        </button>
      </div>

      <div className="chips">
        {FILTROS.map(f => (
          <button key={f.value} className={'chip' + (filtro === f.value ? ' on' : '')}
                  onClick={() => setFiltro(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {buscando && (
        <div className="card stack">
          <div className="small muted">
            Exporta los {visibles.length} movimientos que ves ({monthName(am)} {ay}
            {filtrando ? ', con el filtro actual' : ''}) a un archivo CSV que abre Excel o Google Sheets.
          </div>
          <button className="btn btn-block" onClick={exportar}>
            <Icon name="download" size={18} /> Descargar CSV
          </button>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="empty">Cargando…</div>
      ) : visibles.length === 0 ? (
        <div className="list">
          <div className="empty">
            {filtrando ? 'Nada coincide con la búsqueda.' : 'Sin movimientos este mes.'}
            {!filtrando && (
              <>
                <br />
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setEditing('new')}>
                  Registrar el primero
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        grupos.map(([fecha, lista]) => {
          const neto = lista.reduce((s, t) =>
            s + (t.kind === 'ingreso' ? 1 : t.kind === 'egreso' ? -1 : 0) * Number(t.amount), 0)
          return (
            <div key={fecha}>
              <div className="between">
                <div className="section-title">{etiquetaDia(fecha)}</div>
                {neto !== 0 && (
                  <span className="small faint num" style={{ marginTop: 16, marginRight: 4 }}>
                    {neto > 0 ? '+' : '−'}{money(Math.abs(neto))}
                  </span>
                )}
              </div>
              <div className="list" style={{ marginTop: 6 }}>
                {lista.map(t => (
                  <Row
                    key={t.id}
                    tx={t}
                    onEdit={() => setEditing(t)}
                    onRepeat={() => setEditing({ plantilla: t })}
                    onReceipt={() => setReceipt(t)}
                    onDelete={async () => {
                      if (!confirm('¿Borrar este movimiento?')) return
                      try { await deleteTransaction(t.id); load(); toast('Movimiento borrado') }
                      catch (e) { setError(e.message) }
                    }}
                  />
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function Row({ tx: t, onEdit, onDelete, onReceipt, onRepeat }) {
  const [open, setOpen] = useState(false)

  let icono = t.category?.emoji ?? '📌'
  let signo = ''
  let clase = ''
  let detalle = t.category?.name ?? 'Sin categoría'

  if (t.kind === 'ingreso') { signo = '+'; clase = 'pos' }
  if (t.kind === 'egreso')  { signo = '−'; clase = '' }
  if (t.kind === 'transferencia') {
    icono = '🔄'
    detalle = `${t.account?.name ?? '?'} → ${t.destino?.name ?? '?'}`
  } else if (t.account?.name) {
    detalle = `${detalle} · ${t.account.name}`
  }

  return (
    <>
      <button className="list-item" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span className="avatar">{icono}</span>
        <span className="grow">
          <span className="line-1">
            {t.description || (t.kind === 'transferencia' ? 'Transferencia' : 'Sin concepto')}
          </span>
          <span className="line-2">{detalle}</span>
        </span>
        <span className={'figure-md num ' + clase}>
          {signo}{money(t.amount)}
        </span>
      </button>

      {open && (
        <>
          {t.note && (
            <div style={{ padding: '8px 16px 0', background: 'var(--surface-2)' }}>
              <span className="faint small">📝 {t.note}</span>
            </div>
          )}
          <div className="list-actions">
            <button className="btn" onClick={onEdit}>Editar</button>
            <button className="btn" onClick={onRepeat}>Repetir</button>
            {t.kind !== 'transferencia' && (
              <button className="btn" onClick={onReceipt}>Comprobante</button>
            )}
            <button className="btn btn-ghost neg" style={{ marginLeft: 'auto' }} onClick={onDelete}>
              Borrar
            </button>
          </div>
        </>
      )}
    </>
  )
}

function etiquetaDia(fecha) {
  const hoy = todayISO()
  const [y, m, d] = fecha.split('-').map(Number)
  const dia = DIAS[new Date(y, m - 1, d).getDay()]
  if (fecha === hoy) return `Hoy · ${shortDate(fecha)}`
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1)
  const p = (x) => String(x).padStart(2, '0')
  if (fecha === `${ayer.getFullYear()}-${p(ayer.getMonth() + 1)}-${p(ayer.getDate())}`) {
    return `Ayer · ${shortDate(fecha)}`
  }
  return `${dia} ${shortDate(fecha)}`
}

function agrupar(items) {
  const mapa = new Map()
  for (const t of items) {
    if (!mapa.has(t.occurred_on)) mapa.set(t.occurred_on, [])
    mapa.get(t.occurred_on).push(t)
  }
  return [...mapa.entries()]
}
