import { describe, it, expect } from 'vitest'
import {
  parseAmount, isExpression, addMonthsISO, addDaysISO, monthBounds,
  money, moneyExact, setHideAmounts, longDate, daysInMonth
} from '../format.js'

describe('parseAmount', () => {
  it('acepta números con comas y espacios', () => {
    expect(parseAmount('1,500.50')).toBe(1500.5)
    expect(parseAmount(' 1 500 ')).toBe(1500)
    expect(parseAmount(25)).toBe(25)
  })
  it('hace cuentas sencillas', () => {
    expect(parseAmount('150+75')).toBe(225)
    expect(parseAmount('3*45.50')).toBe(136.5)
    expect(parseAmount('1000/3')).toBe(333.33)
    expect(parseAmount('(100+50)*2')).toBe(300)
    expect(parseAmount('2x10')).toBe(20)
  })
  it('devuelve NaN si no se entiende', () => {
    expect(parseAmount('')).toBeNaN()
    expect(parseAmount('abc')).toBeNaN()
    expect(parseAmount('10+')).toBeNaN()
    expect(parseAmount('alert(1)')).toBeNaN()
    expect(parseAmount('5/0')).toBeNaN()
  })
  it('distingue una cuenta de un número', () => {
    expect(isExpression('150+75')).toBe(true)
    expect(isExpression('1,500')).toBe(false)
    expect(isExpression('-20')).toBe(false)
  })
})

describe('fechas', () => {
  it('suma meses respetando fin de mes', () => {
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsISO('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonthsISO('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonthsISO('2026-03-10', -5)).toBe('2025-10-10')
  })
  it('suma días cruzando año', () => {
    expect(addDaysISO('2026-12-25', 15)).toBe('2027-01-09')
  })
  it('límites del mes', () => {
    expect(monthBounds('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(daysInMonth('2024-02-01')).toBe(29)
  })
  it('fecha larga', () => {
    expect(longDate('2026-11-10')).toBe('10 de noviembre de 2026')
  })
})

describe('modo privado', () => {
  it('oculta money pero no moneyExact', () => {
    setHideAmounts(true)
    expect(money(100)).toBe('L ••••')
    expect(moneyExact(100)).not.toContain('•')
    setHideAmounts(false)
    expect(money(100)).toBe(moneyExact(100))
  })
})
