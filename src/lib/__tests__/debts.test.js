import { describe, it, expect, vi, beforeEach } from 'vitest'

// Simula Supabase: guarda lo que se inserta y responde lo mínimo.
const inserts = []
const rpcs = []
vi.mock('../supabase.js', () => {
  const tabla = (nombre) => {
    const q = {
      _rows: nombre === 'categories' ? [] : [],
      select() { return q }, eq() { return q }, order() { return Promise.resolve({ data: q._rows, error: null }) },
      insert(row) { inserts.push({ tabla: nombre, row }); return { select: () => ({ single: () => Promise.resolve({ data: { id: 'cat-int', ...row }, error: null }) }), then: (r) => r({ error: null }) } }
    }
    return q
  }
  return { supabase: { from: tabla, rpc: (fn, args) => { rpcs.push({ fn, args }); return Promise.resolve({ error: null }) } } }
})

const { breakdown, payDebt } = await import('../debts.js')
const { initialFor } = await import('../accounts.js')
const { occurrencesBetween } = await import('../payments.js')

beforeEach(() => { inserts.length = 0; rpcs.length = 0 })

describe('breakdown', () => {
  it('suma capital + intereses + otros', () => {
    expect(breakdown({ capital: '1,500', interes: '320.50', otros: '' })).toMatchObject({ total: 1820.5, valido: true })
    expect(breakdown({ capital: '1000', interes: '100+50', otros: '25' }).total).toBe(1175)
  })
  it('rechaza negativos o texto', () => {
    expect(breakdown({ capital: '-5', interes: '', otros: '' }).valido).toBe(false)
    expect(breakdown({ capital: 'abc', interes: '', otros: '' }).valido).toBe(false)
  })
})

describe('payDebt', () => {
  const debt = { id: 'loan', name: 'Préstamo BAC', type: 'prestamo', balance: -50000 }

  it('sin pago programado: capital como transferencia y intereses como gasto', async () => {
    await payDebt({ fromAccountId: 'bank', debtAccount: debt, capital: '2000', interes: '450', otros: '' })
    const tx = inserts.filter(i => i.tabla === 'transactions').map(i => i.row)
    expect(tx).toHaveLength(2)
    expect(tx[0]).toMatchObject({ kind: 'transferencia', amount: 2000, account_id: 'bank', to_account_id: 'loan' })
    expect(tx[1]).toMatchObject({ kind: 'egreso', amount: 450, account_id: 'bank', category_id: 'cat-int' })
    // Crea la categoría Intereses porque no existía.
    expect(inserts.some(i => i.tabla === 'categories' && i.row.name === 'Intereses')).toBe(true)
  })

  it('con pago programado: el capital va por mark_payment_paid', async () => {
    await payDebt({ fromAccountId: 'bank', debtAccount: debt, capital: '2000', interes: '0', paymentId: 'p1' })
    expect(rpcs[0]).toMatchObject({ fn: 'mark_payment_paid', args: { p_payment_id: 'p1', p_amount: 2000 } })
    expect(inserts.filter(i => i.tabla === 'transactions')).toHaveLength(0)
  })

  it('no deja marcar una cuota sin capital', async () => {
    await expect(payDebt({ fromAccountId: 'bank', debtAccount: debt, capital: '', interes: '300', paymentId: 'p1' }))
      .rejects.toThrow(/capital/)
  })
})

describe('initialFor', () => {
  it('mueve la partida para que el saldo de hoy quede exacto', () => {
    // partida 1000, hoy 1500 (movimientos +500); real 1200 → partida 700
    expect(initialFor({ initial_balance: 1000, balance: 1500 }, 1200)).toBe(700)
    // deuda: partida -10000, hoy -8000; real -7500 → partida -9500
    expect(initialFor({ initial_balance: -10000, balance: -8000 }, -7500)).toBe(-9500)
  })
})

describe('occurrencesBetween', () => {
  it('expande recurrencias dentro del rango', () => {
    const r = occurrencesBetween([{ due_date: '2026-11-03', recurrence: 'semanal', amount: 10 }], '2026-11-01', '2026-11-30')
    expect(r.map(x => x.fecha)).toEqual(['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24'])
    expect(r[0].primera).toBe(true)
    expect(r[1].primera).toBe(false)
  })
})
