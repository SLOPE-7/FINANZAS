import { listAccounts, esLiquida } from './accounts.js'
import { listTransactions, listTotalsRange, monthTotals } from './transactions.js'
import { listPending, committed } from './payments.js'
import { listCategories } from './categories.js'
import { todayISO, addMonthsISO, monthBounds, daysInMonth } from './format.js'

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                      'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export async function loadDashboard() {
  const hoy = todayISO()
  const mesActual = hoy.slice(0, 7) + '-01'
  const inicioTendencia = addMonthsISO(mesActual, -5)

  const [cuentas, movimientos, pendientes, categorias, rango] = await Promise.all([
    listAccounts(),
    listTransactions({ month: mesActual }),
    listPending(),
    listCategories('egreso').catch(() => []),
    listTotalsRange(inicioTendencia, monthBounds(mesActual).to).catch(() => [])
  ])

  const suma = (lista) => lista.reduce((s, c) => s + Number(c.balance), 0)

  // Disponible = solo lo que está a mano hoy.
  const saldo = suma(cuentas.filter(c => esLiquida(c.type)))
  const apartado = suma(cuentas.filter(c => c.type === 'ahorro'))
  const porCobrar = suma(cuentas.filter(c => c.type === 'por_cobrar'))
  const deudaTarjetas = suma(cuentas.filter(c => c.type === 'tarjeta'))
  const patrimonio = suma(cuentas)

  const { total: comprometido, vencido } = committed(pendientes, 30)
  const { ingresos, egresos, balance } = monthTotals(movimientos)

  const tendencia = agruparPorMes(rango, inicioTendencia, 6)
  const anterior = tendencia[tendencia.length - 2]

  // Ritmo: cuánto gastarías al cierre si sigues igual.
  const diaHoy = Number(hoy.slice(8, 10))
  const diasMes = daysInMonth(hoy)
  const proyeccion = diaHoy > 0 ? (egresos / diaHoy) * diasMes : egresos

  return {
    saldo,
    apartado,
    porCobrar,
    comprometido,
    vencido,
    libre: saldo - comprometido,
    patrimonio,
    deudaTarjetas,
    ingresos,
    egresos,
    balance,
    tasaAhorro: ingresos > 0 ? Math.round((balance / ingresos) * 100) : null,
    egresosAnterior: anterior?.egresos ?? 0,
    mesAnterior: anterior?.etiqueta ?? '',
    proyeccion,
    diaHoy,
    diasMes,
    tendencia,
    proximos: pendientes.slice(0, 5),
    porCategoria: agruparPorCategoria(movimientos, categorias),
    tarjetas: cuentas.filter(c => c.type === 'tarjeta' && (c.due_day || c.statement_day)),
    sinCuentas: cuentas.length === 0
  }
}

function agruparPorMes(items, desde, meses) {
  const lista = []
  for (let i = 0; i < meses; i++) {
    const inicio = addMonthsISO(desde, i)
    const m = Number(inicio.slice(5, 7))
    lista.push({ clave: inicio.slice(0, 7), etiqueta: MESES_CORTOS[m - 1], ingresos: 0, egresos: 0 })
  }
  const porClave = new Map(lista.map(x => [x.clave, x]))
  for (const t of items) {
    const mes = porClave.get(t.occurred_on.slice(0, 7))
    if (!mes) continue
    if (t.kind === 'ingreso') mes.ingresos += Number(t.amount)
    else if (t.kind === 'egreso') mes.egresos += Number(t.amount)
  }
  return lista
}

// Suma los gastos por categoría principal: las subcategorías se
// acumulan en su padre, que es donde vive el presupuesto.
function agruparPorCategoria(movimientos, categorias) {
  const porId = new Map(categorias.map(c => [c.id, c]))
  const mapa = new Map()

  for (const c of categorias) {
    if (!c.parent_id && Number(c.budget) > 0) {
      mapa.set(c.id, base(c))
    }
  }

  for (const t of movimientos) {
    if (t.kind !== 'egreso') continue
    let cat = t.category
    if (cat?.parent_id && porId.has(cat.parent_id)) cat = porId.get(cat.parent_id)
    const key = cat?.id ?? 'sin'
    const prev = mapa.get(key) ?? base(cat ? (porId.get(cat.id) ?? cat) : null)
    prev.total += Number(t.amount)
    mapa.set(key, prev)
  }

  const lista = [...mapa.values()].sort((a, b) => b.total - a.total)
  const max = Math.max(0, ...lista.map(x => Math.max(x.total, x.presupuesto ?? 0)))

  return lista.map(x => ({
    ...x,
    pct: max > 0 ? Math.round((x.total / max) * 100) : 0,
    pctPresupuesto: x.presupuesto ? Math.round((x.total / x.presupuesto) * 100) : null
  }))
}

function base(c) {
  return {
    id: c?.id ?? 'sin',
    nombre: c?.name ?? 'Sin categoría',
    emoji: c?.emoji ?? '📌',
    color: c?.color ?? '#8b8b93',
    presupuesto: Number(c?.budget) > 0 ? Number(c.budget) : null,
    total: 0
  }
}
