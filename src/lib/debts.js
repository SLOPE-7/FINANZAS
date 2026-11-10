import { createTransaction } from './transactions.js'
import { ensureCategory } from './categories.js'
import { markPaid } from './payments.js'
import { parseAmount, todayISO } from './format.js'

const n = (x) => {
  if (x === '' || x === null || x === undefined) return 0
  const v = parseAmount(x)
  return Number.isFinite(v) ? v : NaN
}

// Desglose de una cuota: capital + intereses + otros cargos = total.
export function breakdown({ capital, interes, otros }) {
  const c = n(capital), i = n(interes), o = n(otros)
  const valido = [c, i, o].every(x => Number.isFinite(x) && x >= 0)
  const total = valido ? Math.round((c + i + o) * 100) / 100 : NaN
  return { capital: c, interes: i, otros: o, total, valido }
}

// Registra el pago de una cuota de préstamo o tarjeta como un solo
// pago desde `fromAccountId`, separado en lo que corresponde:
// - Capital: transferencia hacia la cuenta de la deuda (baja lo que debes;
//   no es gasto, el dinero solo cambia de lugar).
// - Intereses y otros cargos: gasto en la categoría "Intereses"
//   (ese dinero sí se va).
// Si viene de un pago programado, el capital se registra con
// mark_payment_paid para que el pago avance a la siguiente cuota.
export async function payDebt({
  fromAccountId, debtAccount, capital, interes, otros,
  fecha = todayISO(), paymentId = null, nombre = ''
}) {
  const b = breakdown({ capital, interes, otros })
  if (!b.valido) throw new Error('Revisa los montos: deben ser números, sin negativos.')
  if (!(b.total > 0)) throw new Error('El total tiene que ser mayor que cero.')
  if (!fromAccountId) throw new Error('Elige la cuenta de donde salió el dinero.')
  if (paymentId && !(b.capital > 0)) {
    throw new Error('Para marcar la cuota como pagada debe llevar algo de capital. Si solo pagaste intereses, regístralo como gasto en Movimientos.')
  }

  const etiqueta = nombre || debtAccount?.name || 'préstamo'

  // 1. Capital
  if (b.capital > 0) {
    if (paymentId) {
      await markPaid({ paymentId, accountId: fromAccountId, paidOn: fecha, amount: b.capital })
    } else {
      await createTransaction({
        kind: 'transferencia',
        amount: b.capital,
        occurred_on: fecha,
        account_id: fromAccountId,
        to_account_id: debtAccount.id,
        description: `Abono a capital · ${etiqueta}`
      })
    }
  }

  // 2. Intereses y cargos. Si esto falla, el capital ya quedó registrado:
  // se avisa para que el usuario no lo repita.
  try {
    if (b.interes > 0 || b.otros > 0) {
      const cat = await ensureCategory({ name: 'Intereses', emoji: '📈', color: '#e34948' })
      if (b.interes > 0) {
        await createTransaction({
          kind: 'egreso', amount: b.interes, occurred_on: fecha,
          account_id: fromAccountId, category_id: cat.id,
          description: `Intereses · ${etiqueta}`
        })
      }
      if (b.otros > 0) {
        await createTransaction({
          kind: 'egreso', amount: b.otros, occurred_on: fecha,
          account_id: fromAccountId, category_id: cat.id,
          description: `Seguro y cargos · ${etiqueta}`
        })
      }
    }
  } catch (e) {
    if (b.capital > 0) {
      throw new Error(`El capital se registró, pero no los intereses (${e.message}). Agrégalos como gasto en Movimientos.`)
    }
    throw e
  }

  return b
}
