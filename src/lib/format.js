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
