import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { money, shortDate, daysUntil } from '../lib/format.js'
import { loadDashboard } from '../lib/dashboard.js'
import TrendChart from '../components/TrendChart.jsx'

export default function Dashboard() {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDashboard().then(setD).catch(e => setError(e.message))
  }, [])

  if (error) return <div className="page"><div className="error">{error}</div></div>
  if (!d) return <div className="page"><div className="empty">Cargando…</div></div>

  if (d.sinCuentas) {
    return (
      <div className="page stack">
        <div className="card-hero stack">
          <div className="figure-label">Bienvenido</div>
          <p style={{ fontSize: 15 }}>
            Empieza agregando tus cuentas: banco, efectivo, tarjetas. Desde ahí se calcula todo lo demás.
          </p>
          <Link to="/cuentas" className="btn btn-primary btn-block">Agregar mis cuentas</Link>
        </div>
      </div>
    )
  }

  const negativo = d.libre < 0
  const cambio = d.egresosAnterior > 0
    ? Math.round(((d.egresos - d.egresosAnterior) / d.egresosAnterior) * 100)
    : null

  return (
    <div className="page stack">
      <div className="card-hero">
        <div className="figure-label">Realmente disponible</div>
        <div className={'figure-xl num ' + (negativo ? 'neg' : '')}>
          {money(d.libre)}
        </div>

        <div className="divider">
          <Linea etiqueta="Efectivo y bancos" valor={money(d.saldo)} />
          <Linea
            etiqueta="Comprometido en 30 días"
            valor={'− ' + money(d.comprometido)}
            clase="warn"
          />
        </div>

        {negativo && (
          <p className="neg small" style={{ marginTop: 10 }}>
            Tus pagos próximos superan lo que tienes a mano.
          </p>
        )}

        {d.vencido > 0 && (
          <Link to="/pagos" className="badge neg" style={{ marginTop: 10, textDecoration: 'none' }}>
            {money(d.vencido)} en pagos vencidos ›
          </Link>
        )}
      </div>

      <div className="card">
        <div className="between">
          <div>
            <div className="figure-label">Ingresos del mes</div>
            <div className="figure-md num pos">{money(d.ingresos)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="figure-label">Gastos del mes</div>
            <div className="figure-md num neg">{money(d.egresos)}</div>
          </div>
        </div>
        <div className="divider">
          <Linea
            etiqueta="Balance"
            valor={money(d.balance)}
            clase={d.balance < 0 ? 'neg' : 'pos'}
          />
          {d.tasaAhorro !== null && (
            <Linea etiqueta="Ahorras de lo que entra" valor={`${d.tasaAhorro}%`}
                   clase={d.tasaAhorro < 0 ? 'neg' : ''} />
          )}
          {d.egresos > 0 && d.diaHoy < d.diasMes && (
            <Linea etiqueta="Gasto proyectado al cierre" valor={money(d.proyeccion)} />
          )}
          {cambio !== null && (
            <p className="small faint" style={{ marginTop: 8 }}>
              Llevas {Math.abs(cambio)}% {cambio >= 0 ? 'más' : 'menos'} que todo {d.mesAnterior}
              {cambio >= 0 && d.diaHoy < d.diasMes ? ' — y el mes aún no termina.' : '.'}
            </p>
          )}
        </div>
      </div>

      {d.tendencia.some(m => m.ingresos || m.egresos) && (
        <div className="card">
          <TrendChart data={d.tendencia} />
        </div>
      )}

      {(d.apartado > 0 || d.porCobrar > 0) && (
        <div className="card">
          <div className="figure-label">Tuyo, pero no disponible</div>
          <div style={{ marginTop: 6 }}>
            {d.apartado > 0 && <Linea etiqueta="Ahorro apartado" valor={money(d.apartado)} />}
            {d.porCobrar > 0 && <Linea etiqueta="Te deben" valor={money(d.porCobrar)} />}
          </div>
        </div>
      )}

      {d.proximos.length > 0 && (
        <>
          <div className="between">
            <div className="section-title">Próximos pagos</div>
            <Link to="/pagos" className="small faint" style={{ marginTop: 16, textDecoration: 'none' }}>
              Ver todos ›
            </Link>
          </div>
          <div className="list">
            {d.proximos.map(p => {
              const { texto, clase } = estadoFecha(p.due_date)
              return (
                <Link key={p.id} to="/pagos" className="list-item">
                  <span className="avatar">{p.target?.emoji ?? p.category?.emoji ?? '📅'}</span>
                  <span className="grow">
                    <span className="line-1">{p.name}</span>
                    <span className={'small ' + clase}>{texto}</span>
                  </span>
                  <span className="figure-md num">{money(p.amount)}</span>
                </Link>
              )
            })}
          </div>
        </>
      )}

      {d.tarjetas.length > 0 && (
        <>
          <div className="section-title">Tarjetas</div>
          <div className="list">
            {d.tarjetas.map(t => {
              const prox = proximoDia(t.due_day)
              const corte = proximoDia(t.statement_day)
              return (
                <div key={t.id} className="list-item" style={{ cursor: 'default' }}>
                  <span className="avatar">{t.emoji}</span>
                  <span className="grow">
                    <span className="line-1">{t.name}</span>
                    <span className="line-2">
                      {corte !== null && `corte en ${corte} d`}
                      {corte !== null && prox !== null && ' · '}
                      {prox !== null && (
                        <span className={prox <= 3 ? 'warn' : ''}>pago en {prox} d</span>
                      )}
                    </span>
                  </span>
                  <span className="figure-md num">{money(Math.abs(Number(t.balance)))}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {d.porCategoria.length > 0 && (
        <>
          <div className="between">
            <div className="section-title">Gastos del mes por categoría</div>
            <Link to="/ajustes" className="small faint" style={{ marginTop: 16, textDecoration: 'none' }}>
              Presupuestos ›
            </Link>
          </div>
          <div className="card stack" style={{ gap: 14 }}>
            {d.porCategoria.slice(0, 10).map(c => {
              const excedido = c.pctPresupuesto !== null && c.pctPresupuesto > 100
              const cerca = c.pctPresupuesto !== null && c.pctPresupuesto >= 85 && !excedido
              return (
                <div key={c.id}>
                  <div className="between" style={{ marginBottom: 5 }}>
                    <span style={{ fontSize: 14 }}>{c.emoji} {c.nombre}</span>
                    <span className="num" style={{ fontSize: 14 }}>
                      {money(c.total)}
                      {c.presupuesto && <span className="faint"> / {money(c.presupuesto)}</span>}
                    </span>
                  </div>
                  <div className="progress">
                    <div style={{
                      width: `${c.presupuesto ? Math.min(100, c.pctPresupuesto) : c.pct}%`,
                      background: excedido ? 'var(--neg)' : cerca ? 'var(--warn)' : c.color
                    }} />
                  </div>
                  {c.presupuesto && (
                    <div className={'small ' + (excedido ? 'neg' : cerca ? 'warn' : 'faint')} style={{ marginTop: 3 }}>
                      {excedido
                        ? `Te pasaste ${money(c.total - c.presupuesto)} (${c.pctPresupuesto}%)`
                        : `Quedan ${money(c.presupuesto - c.total)} · ${c.pctPresupuesto}% usado`}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="card">
        <div className="between">
          <span className="figure-label">Patrimonio neto</span>
          <span className="num figure-md">{money(d.patrimonio)}</span>
        </div>
        {d.deudaTarjetas < 0 && (
          <div className="faint small" style={{ marginTop: 6 }}>
            Incluye {money(Math.abs(d.deudaTarjetas))} de deuda en tarjetas
          </div>
        )}
      </div>
    </div>
  )
}

export function estadoFecha(dateISO) {
  const dias = daysUntil(dateISO)
  if (dias < 0)   return { texto: `vencido hace ${Math.abs(dias)} d`, clase: 'neg' }
  if (dias === 0) return { texto: 'vence hoy', clase: 'neg' }
  if (dias === 1) return { texto: 'mañana', clase: 'warn' }
  if (dias <= 3)  return { texto: `en ${dias} días`, clase: 'warn' }
  return { texto: shortDate(dateISO), clase: 'faint' }
}

// Días hasta la próxima vez que llega el día `dia` del mes.
function proximoDia(dia) {
  if (!dia) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const enMes = (y, m) => new Date(y, m, Math.min(dia, new Date(y, m + 1, 0).getDate()))
  let f = enMes(hoy.getFullYear(), hoy.getMonth())
  if (f < hoy) f = enMes(hoy.getFullYear(), hoy.getMonth() + 1)
  return Math.round((f - hoy) / 86400000)
}

function Linea({ etiqueta, valor, clase = '' }) {
  return (
    <div className="between" style={{ marginTop: 4 }}>
      <span className="muted" style={{ fontSize: 13 }}>{etiqueta}</span>
      <span className={'num ' + clase} style={{ fontSize: 14 }}>{valor}</span>
    </div>
  )
}
