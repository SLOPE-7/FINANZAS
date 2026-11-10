// Formato de dinero y fechas. Todo en lempiras.
// Las fechas se manejan como texto YYYY-MM-DD para evitar
// que la zona horaria corra los días un día atrás.

const nf = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

export function money(value) {
  const n = Number(value)
  return nf.format(Number.isFinite(n) ? n : 0)
}

export function moneySigned(value) {
  const n = Number(value) || 0
  return (n > 0 ? '+' : '') + money(n)
}

export function todayISO() {
  const d = new Date()
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function monthBounds(dateISO = todayISO()) {
  const [y, m] = dateISO.split('-').map(Number)
  const p = (x) => String(x).padStart(2, '0')
  const last = new Date(y, m, 0).getDate()
  return { from: `${y}-${p(m)}-01`, to: `${y}-${p(m)}-${p(last)}` }
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
               'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function shortDate(dateISO) {
  if (!dateISO) return ''
  const [, m, d] = dateISO.split('-')
  return `${Number(d)} ${MESES[Number(m) - 1]}`
}

export function daysUntil(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((target - now) / 86400000)
}

// Convierte lo que el usuario escribe en un número. Acepta comas de
// miles y espacios ("1,500.50", "1 500"). Devuelve NaN si no es un
// número, para que los formularios puedan avisar en vez de guardar 0.
export function parseAmount(x) {
  if (typeof x === 'number') return x
  const limpio = String(x ?? '').replace(/[\s,]/g, '')
  if (limpio === '') return NaN
  const n = Number(limpio)
  return Number.isFinite(n) ? n : NaN
}

// Suma días a una fecha YYYY-MM-DD sin pasar por UTC.
export function addDaysISO(dateISO, dias) {
  const [y, m, d] = dateISO.split('-').map(Number)
  const f = new Date(y, m - 1, d + dias)
  const p = (x) => String(x).padStart(2, '0')
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`
}

// Suma meses respetando fin de mes: 31 ene + 1 mes = 28/29 feb.
export function addMonthsISO(dateISO, meses) {
  const [y, m, d] = dateISO.split('-').map(Number)
  const ultimo = new Date(y, m - 1 + meses + 1, 0).getDate()
  const f = new Date(y, m - 1 + meses, Math.min(d, ultimo))
  const p = (x) => String(x).padStart(2, '0')
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`
}

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function monthName(m) {
  return MESES_LARGOS[m - 1] ?? ''
}

export function longDate(dateISO) {
  if (!dateISO) return ''
  const [y, m, d] = dateISO.split('-').map(Number)
  return `${d} de ${MESES_LARGOS[m - 1]} de ${y}`
}

export function nowHHMM() {
  const d = new Date()
  const p = (x) => String(x).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}
