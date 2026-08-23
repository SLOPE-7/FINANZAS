import { supabase } from './supabase.js'

export const ACCOUNT_TYPES = [
  { value: 'banco',     label: 'Banco',     emoji: '🏦' },
  { value: 'efectivo',  label: 'Efectivo',  emoji: '💵' },
  { value: 'tarjeta',   label: 'Tarjeta de crédito', emoji: '💳' },
  { value: 'billetera', label: 'Billetera', emoji: '📱' }
]

export function typeLabel(value) {
  return ACCOUNT_TYPES.find(t => t.value === value)?.label ?? value
}

export async function listAccounts({ includeArchived = false } = {}) {
  let q = supabase.from('account_balances').select('*')
  if (!includeArchived) q = q.eq('archived', false)
  const { data, error } = await q.order('type').order('name')
  if (error) throw error
  return data ?? []
}

export async function getAccount(id) {
  const { data, error } = await supabase
    .from('accounts').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createAccount(values) {
  const { error } = await supabase.from('accounts').insert(clean(values))
  if (error) throw error
}

export async function updateAccount(id, values) {
  const { error } = await supabase.from('accounts').update(clean(values)).eq('id', id)
  if (error) throw error
}

export async function archiveAccount(id) {
  const { error } = await supabase.from('accounts').update({ archived: true }).eq('id', id)
  if (error) throw error
}

export async function unarchiveAccount(id) {
  const { error } = await supabase.from('accounts').update({ archived: false }).eq('id', id)
  if (error) throw error
}

// Borra solo si la cuenta no tiene movimientos. Si los tiene,
// la base de datos lo impide (on delete restrict) y devolvemos
// un mensaje entendible en vez del error de Postgres.
export async function deleteAccount(id) {
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') {
      throw new Error('Esta cuenta tiene movimientos. Archívala en vez de borrarla.')
    }
    throw error
  }
}

// Los campos que solo aplican a tarjetas se anulan en los demás tipos,
// para que no queden datos huérfanos si cambias el tipo de cuenta.
function clean(v) {
  const isCard = v.type === 'tarjeta'
  return {
    name: (v.name ?? '').trim(),
    type: v.type,
    emoji: v.emoji || '🏦',
    initial_balance: toNumber(v.initial_balance),
    credit_limit:  isCard ? toNumber(v.credit_limit) : null,
    statement_day: isCard ? toDay(v.statement_day) : null,
    due_day:       isCard ? toDay(v.due_day) : null
  }
}

function toNumber(x) {
  const n = Number(String(x ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function toDay(x) {
  const n = parseInt(x, 10)
  return n >= 1 && n <= 31 ? n : null
}
