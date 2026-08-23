import { listAccounts } from './accounts.js'
import { listTransactions, monthTotals } from './transactions.js'
import { listPending, committed } from './payments.js'
import { todayISO } from './format.js'

export async function loadDashboard() {
  const mesActual = todayISO().slice(0, 7) + '-01'

  const [cuentas, movimientos, pendientes] = await Promise.all([
    listAccounts(),
    listTransactions({ month: mesActual }),
    listPending()
  ])

  // Solo cuentas líquidas. Las tarjetas son deuda, no dinero
  // disponible para gastar, así que no entran aquí.
  const liquidas = cuentas.filter(c => c.type !== 'tarjeta')
  const saldo = liquidas.reduce((s, c) => s + Number(c.balance), 0)

  const patrimonio = cuentas.reduce((s, c) => s + Number(c.balance), 0)
  const deudaTarjetas = cuentas
    .filter(c => c.type === 'tarjeta')
    .reduce((s, c) => s + Number(c.balance), 0)

  const { total: comprometido, vencido } = committed(pendientes, 30)

  const { ingresos, egresos, balance } = monthTotals(movimientos)

  return {
    saldo,
    comprometido,
    vencido,
    libre: saldo - comprometido,
    patrimonio,
    deudaTarjetas,
    ingresos,
    egresos,
    balance,
    proximos: pendientes.slice(0, 5),
    porCategoria: agruparPorCategoria(movimientos),
    sinCuentas: cuentas.length === 0
  }
}

// Suma los egresos del mes por categoría. Si la categoría es hija,
// se agrupa bajo su nombre propio para poder ver el gasto de cada
// hijo por separado.
function agruparPorCategoria(movimientos) {
  const mapa = new Map()

  for (const t of movimientos) {
    if (t.kind !== 'egreso') continue
    const key = t.category?.id ?? 'sin'
    const prev = mapa.get(key) ?? {
      nombre: t.category?.name ?? 'Sin categoría',
      emoji: t.category?.emoji ?? '📌',
      color: t.category?.color ?? '#8b8b93',
      total: 0
    }
    prev.total += Number(t.amount)
    mapa.set(key, prev)
  }

  const lista = [...mapa.values()].sort((a, b) => b.total - a.total)
  const suma = lista.reduce((s, x) => s + x.total, 0)

  return lista.map(x => ({
    ...x,
    pct: suma > 0 ? Math.round((x.total / suma) * 100) : 0
  }))
}
