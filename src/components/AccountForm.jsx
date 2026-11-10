import { useEffect, useState } from 'react'
import { money, parseAmount, todayISO, isExpression } from '../lib/format.js'
import {
  ACCOUNT_TYPES, esDeuda, createAccount, updateAccount, listAccounts, initialFor
} from '../lib/accounts.js'
import { createTransaction } from '../lib/transactions.js'
import Icon from './Icon.jsx'

const EMOJIS = ['🏦', '💵', '💳', '📱', '🐷', '🏧', '💰', '📊', '🤝', '💼', '🏛️', '🏠', '🚗']

// account: fila de accounts + `balance` (saldo de hoy) cuando se edita.
export default function AccountForm({ account, tipo, onDone, onCancel }) {
  const editando = !!account
  const tipoInicial = account?.type ?? tipo ?? 'banco'
  const saldoHoy = Number(account?.balance ?? account?.initial_balance ?? 0)

  const [v, setV] = useState({
    name: account?.name ?? '',
    type: tipoInicial,
    emoji: account?.emoji ?? ACCOUNT_TYPES.find(t => t.value === tipoInicial)?.emoji ?? '🏦',
    // Al editar se pide el saldo de HOY (no el de partida): es lo que
    // la persona conoce y lo que quiere corregir.
    saldo: editando ? String(esDeuda(tipoInicial) ? Math.abs(saldoHoy) : saldoHoy) : '',
    credit_limit: account?.credit_limit ?? '',
    statement_day: account?.statement_day ?? '',
    due_day: account?.due_day ?? ''
  })
  const [depositarEn, setDepositarEn] = useState('')
  const [cuentas, setCuentas] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const esTarjeta = v.type === 'tarjeta'
  const esPrestamo = v.type === 'prestamo'
  const deuda = esDeuda(v.type)
  const set = (k) => (e) => setV(prev => ({ ...prev, [k]: e.target.value }))

  useEffect(() => {
    if (!editando) listAccounts().then(setCuentas).catch(() => {})
  }, [])

  const destinos = cuentas.filter(a => !esDeuda(a.type))
  const monto = v.saldo === '' ? 0 : parseAmount(v.saldo)
  const nuevoPrestamoDepositado = !editando && esPrestamo && !!depositarEn

  async function save() {
    if (!v.name.trim()) { setError('Ponle un nombre a la cuenta'); return }
    if (Number.isNaN(monto)) { setError('El saldo no es un número válido'); return }
    if ((esTarjeta || esPrestamo) && v.credit_limit !== '' && !(parseAmount(v.credit_limit) >= 0)) {
      setError(esTarjeta ? 'El límite de crédito no es un número válido' : 'El monto prestado no es un número válido')
      return
    }
    if (nuevoPrestamoDepositado && !(monto > 0)) {
      setError('Escribe cuánto te prestaron'); return
    }

    setBusy(true); setError('')

    // En deudas se escribe en positivo (el teclado del móvil no trae
    // signo menos) y aquí se guarda en negativo.
    const saldoReal = deuda ? -Math.abs(monto) : monto

    try {
      if (editando) {
        // Mueve el punto de partida lo justo para que el saldo de hoy
        // quede igual a lo escrito. No crea ingresos ni gastos falsos.
        const initial_balance = initialFor(
          { initial_balance: account.initial_balance, balance: saldoHoy }, saldoReal
        )
        await updateAccount(account.id, { ...v, initial_balance })
      } else if (nuevoPrestamoDepositado) {
        // Préstamo recién recibido: la deuda arranca en 0 y el capital se
        // transfiere a la cuenta donde entró el dinero. Así el banco sube,
        // la deuda queda en negativo y no cuenta como ingreso.
        const credit_limit = v.credit_limit === '' ? Math.abs(monto) : v.credit_limit
        const nueva = await createAccount({ ...v, credit_limit, initial_balance: 0 })
        try {
          await createTransaction({
          kind: 'transferencia',
          amount: Math.abs(monto),
          occurred_on: todayISO(),
          account_id: nueva.id,
          to_account_id: depositarEn,
          description: `Desembolso · ${v.name.trim()}`
          })
        } catch (e) {
          throw new Error(`Se creó el préstamo, pero no se pudo registrar el desembolso (${e.message}). Ábrelo en Cuentas y usa "Ajustar saldo".`)
        }
      } else {
        const credit_limit = esPrestamo && v.credit_limit === '' && monto > 0 ? Math.abs(monto) : v.credit_limit
        await createAccount({ ...v, credit_limit, initial_balance: saldoReal })
      }
      onDone()
    } catch (e) {
      setError(e.message); setBusy(false)
    }
  }

  let etiquetaSaldo = 'Saldo de hoy'
  if (esTarjeta) etiquetaSaldo = editando ? 'Deuda de hoy' : 'Lo que debes hoy'
  if (esPrestamo) etiquetaSaldo = editando ? 'Lo que debes hoy' : (depositarEn ? 'Capital prestado' : 'Lo que debes hoy')

  let ayudaSaldo = 'Lo que tienes hoy. A partir de aquí se suman los movimientos que registres.'
  if (deuda) ayudaSaldo = 'En positivo. La app lo registra como deuda.'
  if (editando) {
    const dif = Number.isNaN(monto) ? 0 : (deuda ? -Math.abs(monto) : monto) - saldoHoy
    ayudaSaldo = dif === 0
      ? 'Escribe lo que hay realmente hoy y se corrige al guardar. No crea ingresos ni gastos.'
      : `Se corrige ${dif > 0 ? 'sumando' : 'restando'} ${money(Math.abs(dif))}. No crea ingresos ni gastos en tus reportes.`
  }
  if (nuevoPrestamoDepositado) {
    const destino = destinos.find(a => a.id === depositarEn)
    ayudaSaldo = `Se suma a ${destino?.name ?? 'la cuenta elegida'} y queda como deuda. No cuenta como ingreso.`
  }

  return (
    <div className="page stack">
      <div className="between">
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          <Icon name="back" size={18} /> Cancelar
        </button>
        <span className="figure-label">
          {editando ? 'Editar cuenta' : esPrestamo ? 'Nuevo préstamo' : 'Nueva cuenta'}
        </span>
      </div>

      <div className="card stack">
        <div>
          <label htmlFor="type">Tipo</label>
          <select id="type" value={v.type} onChange={e => {
            const type = e.target.value
            const sugerido = ACCOUNT_TYPES.find(t => t.value === type)?.emoji
            setV(prev => ({
              ...prev, type,
              // Cambia el ícono solo si seguía el del tipo anterior.
              emoji: ACCOUNT_TYPES.some(t => t.emoji === prev.emoji) && sugerido ? sugerido : prev.emoji
            }))
          }}>
            {ACCOUNT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
            ))}
          </select>
          {editando && esDeuda(tipoInicial) !== deuda && (
            <p className="hint warn">Cambiar entre deuda y no deuda invierte el signo del saldo. Revisa el monto.</p>
          )}
        </div>

        <div>
          <label htmlFor="name">Nombre</label>
          <input
            id="name" value={v.name} onChange={set('name')}
            placeholder={esPrestamo ? 'Préstamo Banco Atlántida' : esTarjeta ? 'Visa BAC' : 'Banco Atlántida'}
          />
        </div>

        <div>
          <label>Ícono</label>
          <div className="row wrap" style={{ gap: 6 }}>
            {EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setV(prev => ({ ...prev, emoji: e }))}
                className={'chip' + (v.emoji === e ? ' on' : '')}
                style={{ fontSize: 18, padding: '6px 10px' }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      {esPrestamo && !editando && (
        <div className="card stack">
          <div>
            <label htmlFor="dep">¿Dónde recibiste el dinero?</label>
            <select id="dep" value={depositarEn} onChange={e => setDepositarEn(e.target.value)}>
              <option value="">No lo registres (ya lo tenía en mis cuentas)</option>
              {destinos.map(a => (
                <option key={a.id} value={a.id}>{a.emoji} {a.name} · {money(a.balance)}</option>
              ))}
            </select>
            <p className="hint">
              {depositarEn
                ? 'El capital entra a esa cuenta hoy.'
                : 'Elige esta opción si es un préstamo viejo: solo se anota lo que debes hoy.'}
            </p>
          </div>
        </div>
      )}

      <div className="card stack">
        <div>
          <label htmlFor="saldo">{etiquetaSaldo}</label>
          <input
            id="saldo" type="text" inputMode="decimal" className="input-amount"
            value={v.saldo} onChange={set('saldo')}
            placeholder="0.00" autoComplete="off"
          />
          {isExpression(v.saldo) && !Number.isNaN(monto) && (
            <p className="hint num">= {money(monto)}</p>
          )}
          <p className="hint">{ayudaSaldo}</p>
        </div>

        {esPrestamo && (!nuevoPrestamoDepositado) && (
          <div>
            <label htmlFor="orig">Monto original prestado (opcional)</label>
            <input
              id="orig" type="text" inputMode="decimal"
              value={v.credit_limit} onChange={set('credit_limit')}
              placeholder="Para ver cuánto llevas pagado"
            />
          </div>
        )}
      </div>

      {(esTarjeta || esPrestamo) && (
        <div className="card stack">
          <span className="figure-label">{esTarjeta ? 'Datos de la tarjeta (opcional)' : 'Cuota (opcional)'}</span>

          {esTarjeta && (
            <div>
              <label htmlFor="limit">Límite de crédito</label>
              <input
                id="limit" type="text" inputMode="decimal"
                value={v.credit_limit} onChange={set('credit_limit')}
                placeholder="30000"
              />
            </div>
          )}

          <div className="row" style={{ gap: 12 }}>
            {esTarjeta && (
              <div className="grow">
                <label htmlFor="cut">Día de corte</label>
                <input
                  id="cut" type="number" min="1" max="31"
                  value={v.statement_day} onChange={set('statement_day')}
                  placeholder="15"
                />
              </div>
            )}
            <div className="grow">
              <label htmlFor="due">Día de pago</label>
              <input
                id="due" type="number" min="1" max="31"
                value={v.due_day} onChange={set('due_day')}
                placeholder="30"
              />
            </div>
          </div>
          {esPrestamo && (
            <p className="hint">
              Después de guardar, en el detalle del préstamo usa <b>Programar cuotas</b> para que
              aparezca en Pagos.
            </p>
          )}
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <button className="btn btn-primary btn-block btn-lg" onClick={save} disabled={busy}>
        {busy ? 'Guardando…' : editando ? 'Guardar cambios' : esPrestamo ? 'Crear préstamo' : 'Crear cuenta'}
      </button>
    </div>
  )
}
