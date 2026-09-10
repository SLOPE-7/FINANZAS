import { useState } from 'react'
import { money, todayISO } from '../lib/format.js'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
               'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fechaLarga(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES[m - 1]} de ${y}`
}

function horaActual() {
  const d = new Date()
  const p = (x) => String(x).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

// Número corto basado en fecha y hora. Suficiente para referirse
// al recibo; no es correlativo fiscal.
function referencia(fecha) {
  const base = (fecha ?? todayISO()).replace(/-/g, '').slice(2)
  const azar = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base}-${azar}`
}

const TIPOS = [
  { value: 'recibi', label: 'Recibí dinero', titulo: 'RECIBO DE DINERO',    campo: 'Recibí de' },
  { value: 'pague',  label: 'Pagué',         titulo: 'CONSTANCIA DE PAGO',  campo: 'Pagué a' }
]

export default function BlankReceipt() {
  const [ref] = useState(() => referencia(todayISO()))
  const [vista, setVista] = useState(false)
  const [d, setD] = useState({
    tipo: 'recibi',
    persona: '',
    motivo: '',
    fecha: todayISO(),
    hora: horaActual(),
    lineas: [{ detalle: '', monto: '' }]
  })

  const set = (k) => (e) => setD(p => ({ ...p, [k]: e.target.value }))
  const tipo = TIPOS.find(t => t.value === d.tipo)

  function setLinea(i, campo, valor) {
    setD(p => {
      const lineas = [...p.lineas]
      lineas[i] = { ...lineas[i], [campo]: valor }
      return { ...p, lineas }
    })
  }

  const agregar = () => setD(p => ({ ...p, lineas: [...p.lineas, { detalle: '', monto: '' }] }))
  const quitar = (i) => setD(p => ({ ...p, lineas: p.lineas.filter((_, j) => j !== i) }))

  const aNum = (x) => Number(String(x ?? '').replace(/[\s,]/g, '')) || 0
  const total = d.lineas.reduce((s, l) => s + aNum(l.monto), 0)

  function limpiar() {
    if (!confirm('¿Vaciar el recibo?')) return
    setD({
      tipo: d.tipo, persona: '', motivo: '',
      fecha: todayISO(), hora: horaActual(),
      lineas: [{ detalle: '', monto: '' }]
    })
    setVista(false)
  }

  function generarPDF() {
    const filas = d.lineas
      .filter(l => l.detalle || l.monto)
      .map(l => `<tr><td>${esc(l.detalle)}</td><td class="der">${money(aNum(l.monto))}</td></tr>`)
      .join('')

    const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Recibo ${ref}</title>
<style>
  @page { size: letter; margin: 20mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 0; line-height: 1.5; }
  .hoja { max-width: 170mm; margin: 0 auto; }
  .cab { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 22px;
         display: flex; justify-content: space-between; align-items: flex-end; }
  h1 { font-size: 20px; margin: 0; letter-spacing: 1px; }
  .ref { font-size: 12px; color: #555; text-align: right; }
  .campo { margin-bottom: 10px; font-size: 14px; }
  .campo span { display: inline-block; min-width: 110px; color: #555; }
  .campo b { border-bottom: 1px solid #ccc; padding: 0 4px; }
  table { width: 100%; border-collapse: collapse; margin: 22px 0; font-size: 14px; }
  th { text-align: left; border-bottom: 1px solid #111; padding: 6px 4px; font-size: 12px;
       text-transform: uppercase; letter-spacing: .5px; }
  td { padding: 7px 4px; border-bottom: 1px solid #eee; }
  .der { text-align: right; }
  .total td { border-top: 2px solid #111; border-bottom: none;
              font-size: 17px; font-weight: bold; padding-top: 10px; }
  .firma { margin-top: 55px; display: flex; justify-content: flex-end; }
  .linea-firma { width: 62mm; border-top: 1px solid #111; text-align: center;
                 padding-top: 6px; font-size: 12px; color: #555; }
  .pie { margin-top: 28px; font-size: 10px; color: #777;
         border-top: 1px solid #ddd; padding-top: 8px; }
</style></head>
<body><div class="hoja">
  <div class="cab">
    <h1>${tipo.titulo}</h1>
    <div class="ref">No. ${ref}<br>${fechaLarga(d.fecha)}${d.hora ? ` · ${esc(d.hora)}` : ''}</div>
  </div>
  <div class="campo"><span>${tipo.campo}:</span> <b>${esc(d.persona) || '&nbsp;'.repeat(40)}</b></div>
  <div class="campo"><span>Por concepto de:</span> <b>${esc(d.motivo) || '&nbsp;'.repeat(40)}</b></div>
  <table>
    <thead><tr><th>Detalle</th><th class="der">Monto</th></tr></thead>
    <tbody>${filas}<tr class="total"><td>TOTAL</td><td class="der">${money(total)}</td></tr></tbody>
  </table>
  <div class="firma"><div class="linea-firma">Firma</div></div>
  <div class="pie">
    Documento de control personal. No constituye factura ni documento fiscal
    autorizado por el SAR.
  </div>
</div>
<script>window.onload = function(){ window.print(); };</script>
</body></html>`

    const w = window.open('', '_blank')
    if (!w) {
      alert('El navegador bloqueó la ventana. Permite ventanas emergentes e inténtalo de nuevo.')
      return
    }
    w.document.write(html)
    w.document.close()
  }

  if (vista) {
    return (
      <div className="page stack">
        <div className="between">
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setVista(false)}>
            ‹ Editar
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={limpiar}>
            Nuevo
          </button>
        </div>

        <Papel d={d} tipo={tipo} total={total} ref_={ref} aNum={aNum} />

        <button className="btn btn-primary btn-block" onClick={generarPDF}>
          Generar PDF
        </button>

        <p className="faint" style={{ fontSize: 12 }}>
          Se abre el diálogo de impresión. Elige Opciones → PDF para guardarlo,
          o Compartir para mandarlo por WhatsApp.
        </p>
      </div>
    )
  }

  return (
    <div className="page stack">
      <div className="row" style={{ gap: 6 }}>
        {TIPOS.map(t => (
          <button
            key={t.value}
            className="btn grow"
            style={{
              fontSize: 13,
              borderColor: d.tipo === t.value ? 'var(--text)' : 'var(--border)',
              color: d.tipo === t.value ? 'var(--text)' : 'var(--muted)'
            }}
            onClick={() => setD(p => ({ ...p, tipo: t.value }))}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card stack">
        <div>
          <label htmlFor="persona">{tipo.campo}</label>
          <input
            id="persona" value={d.persona} onChange={set('persona')}
            placeholder="Nombre completo"
          />
        </div>

        <div>
          <label htmlFor="motivo">Por concepto de</label>
          <input
            id="motivo" value={d.motivo} onChange={set('motivo')}
            placeholder="Abono a préstamo"
          />
        </div>

        <div className="row" style={{ gap: 12 }}>
          <div className="grow">
            <label htmlFor="fecha">Fecha</label>
            <input id="fecha" type="date" value={d.fecha} onChange={set('fecha')} />
          </div>
          <div className="grow">
            <label htmlFor="hora">Hora</label>
            <input id="hora" type="time" value={d.hora} onChange={set('hora')} />
          </div>
        </div>
      </div>

      <div className="card stack">
        <span className="figure-label">Detalle</span>

        {d.lineas.map((l, i) => (
          <div key={i} className="row" style={{ gap: 8 }}>
            <div className="grow">
              <input
                value={l.detalle}
                onChange={e => setLinea(i, 'detalle', e.target.value)}
                placeholder="Descripción"
              />
            </div>
            <div style={{ width: 110 }}>
              <input
                type="text" inputMode="decimal"
                value={l.monto}
                onChange={e => setLinea(i, 'monto', e.target.value)}
                placeholder="0.00"
              />
            </div>
            {d.lineas.length > 1 && (
              <button
                className="btn btn-ghost neg"
                style={{ fontSize: 18, padding: '8px 10px' }}
                onClick={() => quitar(i)}
              >
                ×
              </button>
            )}
          </div>
        ))}

        <button className="btn btn-ghost btn-block" style={{ fontSize: 13 }} onClick={agregar}>
          Agregar línea
        </button>

        <div className="between" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <span className="figure-label">Total</span>
          <span className="figure-md num">{money(total)}</span>
        </div>
      </div>

      <button className="btn btn-primary btn-block" onClick={() => setVista(true)}>
        Ver recibo
      </button>

      <p className="faint" style={{ fontSize: 12 }}>
        Este recibo es independiente. No registra ningún movimiento en tus cuentas.
      </p>
    </div>
  )
}

function Papel({ d, tipo, total, ref_, aNum }) {
  return (
    <div style={{
      background: '#fff', color: '#111', padding: 20, borderRadius: 8,
      fontFamily: 'Georgia, serif'
    }}>
      <div style={{
        borderBottom: '2px solid #111', paddingBottom: 8, marginBottom: 16,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12
      }}>
        <span style={{ fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }}>{tipo.titulo}</span>
        <span style={{ fontSize: 11, color: '#555', textAlign: 'right' }}>
          No. {ref_}<br />
          {fechaLarga(d.fecha)}{d.hora ? ` · ${d.hora}` : ''}
        </span>
      </div>

      <div style={{ fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: '#555' }}>{tipo.campo}: </span>
        <b>{d.persona || '—'}</b>
      </div>
      <div style={{ fontSize: 13, marginBottom: 16 }}>
        <span style={{ color: '#555' }}>Por concepto de: </span>
        <b>{d.motivo || '—'}</b>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #111', padding: '4px 2px', fontSize: 11 }}>
              DETALLE
            </th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #111', padding: '4px 2px', fontSize: 11 }}>
              MONTO
            </th>
          </tr>
        </thead>
        <tbody>
          {d.lineas.filter(l => l.detalle || l.monto).map((l, i) => (
            <tr key={i}>
              <td style={{ padding: '6px 2px', borderBottom: '1px solid #eee' }}>{l.detalle}</td>
              <td style={{ padding: '6px 2px', borderBottom: '1px solid #eee', textAlign: 'right' }}>
                {money(aNum(l.monto))}
              </td>
            </tr>
          ))}
          <tr>
            <td style={{ borderTop: '2px solid #111', paddingTop: 8, fontWeight: 'bold', fontSize: 15 }}>
              TOTAL
            </td>
            <td style={{ borderTop: '2px solid #111', paddingTop: 8, fontWeight: 'bold',
                         fontSize: 15, textAlign: 'right' }}>
              {money(total)}
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: 40, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          width: 160, borderTop: '1px solid #111', textAlign: 'center',
          paddingTop: 4, fontSize: 11, color: '#555'
        }}>
          Firma
        </div>
      </div>

      <div style={{
        marginTop: 20, fontSize: 9, color: '#777',
        borderTop: '1px solid #ddd', paddingTop: 6
      }}>
        Documento de control personal. No constituye factura ni documento fiscal
        autorizado por el SAR.
      </div>
    </div>
  )
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
