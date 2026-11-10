import { describe, it, expect, vi } from 'vitest'

vi.mock('../supabase.js', () => ({ supabase: null }))
const { committed, nextOccurrence } = await import('../payments.js')
const { todayISO, addDaysISO } = await import('../format.js')

const hoy = todayISO()
const P = (dias, amount, recurrence = 'ninguna') =>
  ({ due_date: addDaysISO(hoy, dias), amount, recurrence })

describe('committed', () => {
  it('proyecta pagos semanales dentro de 30 días', () => {
    // hoy+2, +9, +16, +23, +30
    expect(committed([P(2, 100, 'semanal')])).toEqual({ total: 500, vencido: 0 })
  })
  it('cuenta un pago mensual una vez', () => {
    expect(committed([P(5, 1000, 'mensual')]).total).toBe(1000)
  })
  it('suma lo vencido y sus repeticiones futuras', () => {
    // vencido hace 3 días (200) + hoy+12 + hoy+27
    expect(committed([P(-3, 200, 'quincenal')])).toEqual({ total: 600, vencido: 200 })
  })
  it('ignora lo que cae fuera de la ventana', () => {
    expect(committed([P(40, 50)]).total).toBe(0)
  })
})

describe('nextOccurrence', () => {
  it('calcula la siguiente fecha', () => {
    expect(nextOccurrence('2026-01-31', 'mensual')).toBe('2026-02-28')
    expect(nextOccurrence('2026-01-01', 'anual')).toBe('2027-01-01')
    expect(nextOccurrence('2026-01-01', 'ninguna')).toBeNull()
  })
})
