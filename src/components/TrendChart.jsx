import { useState } from 'react'
import { money } from '../lib/format.js'

// Barras agrupadas: ingresos vs gastos de los últimos meses.
// Al tocar un mes se muestran sus cifras (sirve de tooltip en móvil).
export default function TrendChart({ data }) {
  const [sel, setSel] = useState(data.length - 1)
  const W = 320, H = 150, TOP = 8, BOTTOM = 22
  const alto = H - TOP - BOTTOM
  const max = Math.max(1, ...data.flatMap(d => [d.ingresos, d.egresos]))
  const paso = W / data.length
  const barra = Math.min(16, paso / 3.2)
  const y = (v) => TOP + alto - (v / max) * alto
  const actual = data[sel] ?? data[data.length - 1]

  // Barra con las puntas de arriba redondeadas y base recta.
  const rect = (x, v) => {
    const h = Math.max(0, (v / max) * alto)
    if (h < 1) return `M${x},${TOP + alto}h${barra}`
    const r = Math.min(4, h, barra / 2)
    const top = TOP + alto - h
    return `M${x},${TOP + alto}V${top + r}q0,-${r} ${r},-${r}h${barra - 2 * r}q${r},0 ${r},${r}V${TOP + alto}Z`
  }

  return (
    <div className="chart">
      <div className="between" style={{ marginBottom: 10 }}>
        <div className="chart-legend">
          <span><i style={{ background: 'var(--series-1)' }} />Ingresos</span>
          <span><i style={{ background: 'var(--series-2)' }} />Gastos</span>
        </div>
        <span className="faint small">Últimos {data.length} meses</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label="Ingresos y gastos de los últimos meses">
        {[0.5, 1].map(f => (
          <line key={f} className="grid" x1="0" x2={W} y1={y(max * f)} y2={y(max * f)}
                strokeDasharray={f === 1 ? '' : '3 4'} />
        ))}
        {data.map((d, i) => {
          const x0 = i * paso + (paso - (barra * 2 + 2)) / 2
          return (
            <g key={d.clave} className="bar" onClick={() => setSel(i)} onMouseEnter={() => setSel(i)}>
              {i === sel && <rect className="sel" x={i * paso + 2} y={TOP - 4} width={paso - 4}
                                   height={alto + 8} rx="8" />}
              <rect x={i * paso} y="0" width={paso} height={H} fill="transparent" />
              <path d={rect(x0, d.ingresos)} fill="var(--series-1)" />
              <path d={rect(x0 + barra + 2, d.egresos)} fill="var(--series-2)" />
              <text className="axis" x={i * paso + paso / 2} y={H - 6} textAnchor="middle"
                    style={{ fontWeight: i === sel ? 700 : 400 }}>
                {d.etiqueta}
              </text>
              <title>{`${d.etiqueta}: ingresos ${money(d.ingresos)}, gastos ${money(d.egresos)}`}</title>
            </g>
          )
        })}
        <line x1="0" x2={W} y1={TOP + alto} y2={TOP + alto} stroke="var(--border)" />
      </svg>

      <div className="between divider" style={{ marginTop: 8, paddingTop: 10 }}>
        <span className="small muted" style={{ textTransform: 'capitalize' }}>{actual.etiqueta}</span>
        <span className="small num">
          <span className="muted">Ing.</span> {money(actual.ingresos)}
          <span className="muted"> · Gas.</span> {money(actual.egresos)}
          <span className="muted"> · </span>
          <b className={actual.ingresos - actual.egresos < 0 ? 'neg' : 'pos'}>
            {money(actual.ingresos - actual.egresos)}
          </b>
        </span>
      </div>
    </div>
  )
}
