import { useEffect, useState } from 'react'
import { money, shortDate, daysUntil } from '../lib/format.js'
import { loadDashboard } from '../lib/dashboard.js'

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
      <div className="page">
        <div className="card">
          <div className="figure-label">Para empezar</div>
          <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>
            Agrega tus cuentas en la pestaña Cuentas. Desde ahí se calcula todo lo demás.
          </p>
        </div>
      </div>
    )
  }

  const negativo = d.libre < 0

  return (
    <div className="page stack">
      {/* La cifra que importa: lo que queda después de lo ya comprometido */}
      <div className="card">
        <div className="figure-label">Realmente disponible</div>
        <div className={'figure-lg num ' + (negativo ? 'neg' : '')}>
          {money(d.libre)}
        </div>

        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <Linea etiqueta="Saldo en cuentas" valor={money(d.saldo)} />
          <Linea etiqueta="Comprometido en 30 días" valor={'− ' + money(d.comprometido)} clase="warn" />
        </div>

        {negativo && (
          <p className="neg" style={{ fontSize: 13, marginTop: 10 }}>
            Tus pagos próximos superan lo que tienes. Revisa qué puedes mover.
          </p>
        )}

        {d.vencido > 0 && (
          <p className="neg" style={{ fontSize: 13, marginTop: 6 }}>
            {money(d.vencido)} en pagos ya vencidos
          </p>
        )}
      </div>

      {/* Mes en curso */}
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
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <Linea
            etiqueta="Balance"
            valor={money(d.balance)}
            clase={d.balance < 0 ? 'neg' : 'pos'}
          />
        </div>
      </div>

      {/* Próximos pagos */}
      {d.proximos.length > 0 && (
        <>
          <div className="section-title">Próximos pagos</div>
          <div className="list">
            {d.proximos.map(p => {
              const dias = daysUntil(p.due_date)
              let texto, clase
              if (dias < 0)        { texto = `vencido hace ${Math.abs(dias)} d`; clase = 'neg' }
              else if (dias === 0) { texto = 'vence hoy';       clase = 'neg' }
              else if (dias <= 3)  { texto = `en ${dias} días`; clase = 'warn' }
              else                 { texto = shortDate(p.due_date); clase = 'faint' }

              return (
                <div key={p.id} className="list-item" style={{ cursor: 'default' }}>
                  <span style={{ fontSize: 17 }}>{p.category?.emoji ?? '📅'}</span>
                  <span className="grow">
                    <span style={{ display: 'block' }}>{p.name}</span>
                    <span className={clase} style={{ fontSize: 12 }}>{texto}</span>
                  </span>
                  <span className="figure-md num">{money(p.amount)}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Gasto por categoría */}
      {d.porCategoria.length > 0 && (
        <>
          <div className="section-title">Gastos del mes por categoría</div>
          <div className="card stack" style={{ gap: 10 }}>
            {d.porCategoria.slice(0, 8).map((c, i) => (
              <div key={i}>
                <div className="between" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>{c.emoji} {c.nombre}</span>
                  <span className="num" style={{ fontSize: 14 }}>{money(c.total)}</span>
                </div>
                <div style={{
                  height: 4,
                  background: 'var(--surface-2)',
                  borderRadius: 2,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${c.pct}%`,
                    height: '100%',
                    background: c.color
                  }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Patrimonio, al final: informativo, no accionable */}
      <div className="card">
        <div className="between">
          <span className="figure-label">Patrimonio neto</span>
          <span className="num figure-md">{money(d.patrimonio)}</span>
        </div>
        {d.deudaTarjetas < 0 && (
          <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
            Incluye {money(Math.abs(d.deudaTarjetas))} de deuda en tarjetas
          </div>
        )}
      </div>
    </div>
  )
}

function Linea({ etiqueta, valor, clase = '' }) {
  return (
    <div className="between" style={{ marginTop: 4 }}>
      <span className="muted" style={{ fontSize: 13 }}>{etiqueta}</span>
      <span className={'num ' + clase} style={{ fontSize: 14 }}>{valor}</span>
    </div>
  )
}
