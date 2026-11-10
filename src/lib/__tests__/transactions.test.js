import { describe, it, expect, vi } from 'vitest'

vi.mock('../supabase.js', () => ({ supabase: null }))
const { toCSV, monthTotals } = await import('../transactions.js')

describe('monthTotals', () => {
  it('deja fuera las transferencias', () => {
    const r = monthTotals([
      { kind: 'ingreso', amount: '1000' },
      { kind: 'egreso', amount: 300 },
      { kind: 'transferencia', amount: 500 }
    ])
    expect(r).toEqual({ ingresos: 1000, egresos: 300, balance: 700 })
  })
})

describe('toCSV', () => {
  it('usa ; y escapa comillas; los gastos van en negativo', () => {
    const csv = toCSV([{
      occurred_on: '2026-11-10', kind: 'egreso', amount: 150, description: 'Pan "dulce"',
      category: { name: 'Comida' }, account: { name: 'Efectivo' }, note: null
    }])
    const lineas = csv.replace('﻿', '').split('\r\n')
    expect(lineas[0]).toBe('"Fecha";"Tipo";"Concepto";"Categoría";"Cuenta";"Hacia";"Monto";"Nota"')
    expect(lineas[1]).toBe('"2026-11-10";"Gasto";"Pan ""dulce""";"Comida";"Efectivo";"";"-150.00";""')
  })
})
