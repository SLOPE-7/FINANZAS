import { supabase } from './supabase.js'
import { monthBounds } from './format.js'

const SELECT = `
  id, kind, amount, occurred_on, description, note,
  account_id, to_account_id, category_id,
  account:accounts!transactions_account_id_fkey (id, name, emoji),
  destino:accounts!transactions_to_account_id_fkey (id, name, emoji),
  category:categories (id, name, emoji, color)
`

export async function listTransactions({ month, accountId } = {}) {
  let q = supabase.from('transactions').select(SELECT)

  if (month) {
    const { from, to } = monthBounds(month)
    q = q.gte('occurred_on', from).lte('occurred_on', to)
  }
  if (accountId) q = q.eq('account_id', accountId)

  const { data, error } = await q
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

// Las transferencias quedan fuera de los totales a propósito:
// mover dinero de una cuenta a otra no es ingreso ni gasto.
export function monthTotals(items) {
  let ingresos = 0
  let egresos = 0
  for (const t of items) {
    if (t.kind === 'ingreso') ingresos += Number(t.amount)
    else if (t.kind === 'egreso') egresos += Number(t.amount)
  }
  return { ingresos, egresos, balance: ingresos - egresos }
}

export async function createTransaction(v) {
  const { error } = await supabase.from('transactions').insert(clean(v))
  if (error) throw translate(error)
}

export async function updateTransaction(id, v) {
  const { error } = await supabase.from('transactions').update(clean(v)).eq('id', id)
  if (error) throw translate(error)
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

function clean(v) {
  const esTransferencia = v.kind === 'transferencia'
  return {
    kind: v.kind,
    amount: toNumber(v.amount),
    occurred_on: v.occurred_on,
    account_id: v.account_id,
    to_account_id: esTransferencia ? v.to_account_id : null,
    category_id: esTransferencia ? null : (v.category_id || null),
    description: (v.description ?? '').trim(),
    note: (v.note ?? '').trim() || null
  }
}

function toNumber(x) {
  const n = Number(String(x ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

// Convierte los errores de Postgres en algo legible.
function translate(error) {
  if (error.message?.includes('amount_positive')) {
    return new Error('El monto tiene que ser mayor que cero')
  }
  if (error.message?.includes('transfer_shape')) {
    return new Error('En una transferencia las dos cuentas deben ser distintas')
  }
  return error
}
