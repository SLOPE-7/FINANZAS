import { supabase } from './supabase.js'
import { todayISO, parseAmount, addDaysISO, addMonthsISO } from './format.js'

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

export async function listHistory(limit = 80) {
  const { data, error } = await supabase
    .from('scheduled_payments')
    .select(SELECT)
    .neq('status', 'pendiente')
    .order('due_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// Próxima fecha de un pago recurrente, o null si no se repite.
export function nextOccurrence(dateISO, recurrence) {
  switch (recurrence) {
    case 'semanal':   return addDaysISO(dateISO, 7)
    case 'quincenal': return addDaysISO(dateISO, 15)
    case 'mensual':   return addMonthsISO(dateISO, 1)
    case 'anual':     return addMonthsISO(dateISO, 12)
    default:          return null
  }
}

// Todas las fechas en que cae cada pago pendiente dentro de [desde, hasta].
// Sirve para el calendario del centro de pagos.
export function occurrencesBetween(pendientes, desde, hasta) {
  const out = []
  for (const p of pendientes) {
    let fecha = p.due_date
    let guard = 0
    while (fecha && fecha <= hasta && guard++ < 400) {
      if (fecha >= desde) out.push({ fecha, pago: p, primera: fecha === p.due_date })
      fecha = nextOccurrence(fecha, p.recurrence)
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// Cuánto hay que pagar en los próximos `hastaDias` días.
// Los pagos recurrentes se proyectan: un pago semanal cae ~4 veces
// en 30 días y antes solo se contaba una. Las fechas se comparan
// como texto YYYY-MM-DD para no depender de la zona horaria.
export function committed(pendientes, hastaDias = 30) {
  const hoy = todayISO()
  const limite = addDaysISO(hoy, hastaDias)

  let total = 0
  let vencido = 0
  for (const p of pendientes) {
    const monto = Number(p.amount) || 0
    let fecha = p.due_date
    if (!fecha) continue

    if (fecha < hoy) { vencido += monto; total += monto }
    else if (fecha <= limite) total += monto
    else continue

    // Repeticiones futuras dentro de la ventana. Las que ya pasaron
    // no se suman: lo más probable es que solo falte marcarlas.
    let guard = 0
    while ((fecha = nextOccurrence(fecha, p.recurrence)) && fecha <= limite && guard++ < 60) {
      if (fecha >= hoy) total += monto
    }
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
    p_amount: montoReal(amount)
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
  const n = parseAmount(x)
  if (!(n > 0)) throw new Error('El monto tiene que ser un número mayor que cero')
  return n
}

// En "Marcar pagado" el monto es opcional: vacío = el de la cuota.
// Antes, "1,500" se mandaba como NaN y se perdía en silencio.
function montoReal(x) {
  if (x === '' || x === null || x === undefined) return null
  return toNumber(x)
}
