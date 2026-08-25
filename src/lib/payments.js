import { supabase } from './supabase.js'
import { todayISO } from './format.js'

// Con dos claves foráneas hacia accounts hay que nombrarlas
// explícitamente o PostgREST no sabe cuál usar.
const SELECT = `
  id, name, amount, due_date, recurrence, status, notify,
  account_id, category_id, target_account_id,
  account:accounts!scheduled_payments_account_id_fkey (id, name, emoji),
  target:accounts!scheduled_payments_target_account_id_fkey (id, name, emoji, type),
  category:categories (id, name, emoji, color)
`

export const RECURRENCES = [
  { value: 'ninguna',    label: 'Una sola vez' },
  { value: 'semanal',    label: 'Cada semana' },
  { value: 'quincenal',  label: 'Cada 15 días' },
  { value: 'mensual',    label: 'Cada mes' },
  { value: 'anual',      label: 'Cada año' }
]

export async function listPending() {
  const { data, error } = await supabase
    .from('scheduled_payments')
    .select(SELECT)
    .eq('status', 'pendiente')
    .order('due_date')
  if (error) throw error
  return data ?? []
}

export async function listHistory(limit = 30) {
  const { data, error } = await supabase
    .from('scheduled_payments')
    .select(SELECT)
    .neq('status', 'pendiente')
    .order('due_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export function committed(pendientes, hastaDias = 30) {
  const hoy = new Date(todayISO())
  const limite = new Date(hoy)
  limite.setDate(limite.getDate() + hastaDias)

  let total = 0
  let vencido = 0
  for (const p of pendientes) {
    const d = new Date(p.due_date)
    if (d < hoy) { vencido += Number(p.amount); total += Number(p.amount) }
    else if (d <= limite) total += Number(p.amount)
  }
  return { total, vencido }
}

export async function createPayment(v) {
  const { error } = await supabase.from('scheduled_payments').insert(clean(v))
  if (error) throw error
}

export async function updatePayment(id, v) {
  const { error } = await supabase.from('scheduled_payments').update(clean(v)).eq('id', id)
  if (error) throw error
}

export async function deletePayment(id) {
  const { error } = await supabase.from('scheduled_payments').delete().eq('id', id)
  if (error) throw error
}

export async function markPaid({ paymentId, accountId, paidOn, amount }) {
  const { error } = await supabase.rpc('mark_payment_paid', {
    p_payment_id: paymentId,
    p_account_id: accountId,
    p_paid_on: paidOn || todayISO(),
    p_amount: amount ? Number(amount) : null
  })
  if (error) throw error
}

export async function skipPayment(id) {
  const { error } = await supabase
    .from('scheduled_payments')
    .update({ status: 'omitido' })
    .eq('id', id)
  if (error) throw error
}

function clean(v) {
  const abona = !!v.target_account_id
  return {
    name: (v.name ?? '').trim(),
    amount: toNumber(v.amount),
    due_date: v.due_date,
    recurrence: v.recurrence || 'ninguna',
    // Si abona a una cuenta es traslado, no gasto: la categoría sobra.
    category_id: abona ? null : (v.category_id || null),
    account_id: v.account_id || null,
    target_account_id: v.target_account_id || null,
    notify: v.notify !== false
  }
}

function toNumber(x) {
  const n = Number(String(x ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}
