import { useState, useRef } from 'react'
import { money, todayISO } from '../lib/format.js'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
               'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fechaLarga(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES[m - 1]} de ${y}`
}

function referencia(tx) {
  const fecha = (tx.occurred_on ?? '').replace(/-/g, '').slice(2)
  const corto = String(tx.id ?? '').replace(/-/g, '').slice(0, 4).toUpperCase()
  return `${fecha}-${corto}`
}

function horaActual() {
  const d = new Date()
  const p = (x) => String(x).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function Receipt({ tx, onClose }) {
  const esIngreso = tx.kind === 'ingreso'
  const areaRef = useRef(null)

  const [editando, setEditando] = useState(true)
  const [datos, setDatos] = useState({
    persona: '',
    motivo: tx.description ?? '',
    fecha: tx.occurred_on ?? todayISO(),
    hora: horaActual(),
    lineas: [{ detalle: tx.description ?? '', monto: String(tx.amount ?? '') }]
  })

  const set = (k) => (e) => setDatos(p => ({ ...p, [k]: e.target.value }))

  function setLinea(i, campo, valor) {
    setDatos(p => {
      const lineas = [...p.lineas]
      lineas[i] = { ...lineas[i], [campo]: valor }
      return { ...p, lineas }
    })
  }

  function agregarLinea() {
    setDatos(p => ({ ...p, lineas: [...p.lineas, { detalle: '', monto: '' }] }))
  }

  function quitarLinea(i) {
    setDatos(p => ({ ...p, lineas: p.lineas.filter((_, j) => j !== i) }))
  }

  const total = datos.lineas.reduce(
    (s, l) => s + (Number(String(l.monto).replace(/[\s,]/g, '')) || 0), 0
  )

  const titulo = esIngreso ? 'RECIBO DE DINERO' : 'CONSTANCIA DE PAGO'
  const etiquetaPersona = esIngreso ? 'Recibí de' : 'Pagué a'

  // El PDF se arma abriendo una ventana con el recibo en HTML limpio
  // y llamando a imprimir. En iPhone, el diálogo permite guardar como
  // PDF o compartirlo directamente.
  function generarPDF() {
    const filas = datos.lineas
      .filter(l => l.detalle || l.monto)
      .map(l => `
        <tr>
          <td>${escapar(l.detalle)}</td>
          <td class="der">${money(Number(String(l.monto).replace(/[\s,]/g, '')) || 0)}</td>
        </tr>`)
      .join('')

    const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Recibo ${referencia(tx)}</title>
<style>
  @page { size: letter; margin: 20mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    color: #111; margin: 0; line-height: 1.5;
  }
  .hoja { max-width: 170mm; margin: 0 auto; }
  .cab { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 22px;
         display: flex; justify-content: space-between; align-items: flex-end; }
  h1 { font-size: 20px; margin: 0; letter-spacing: 1px; }
  .ref { font-size: 12px; color: #555; text-align: right; }
  .campo { margin-bottom: 10px; font-size: 14px; }
  .campo span { display: inline-block; min-width: 90px; color: #555; }
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
    <h1>${titulo}</h1>
    <div class="ref">
      No. ${referencia(tx)}<br>
      ${fechaLarga(datos.fecha)}${datos.hora ? ` · ${escapar(datos.hora)}` : ''}
    </div>
  </div>

  <div class="campo"><span>${etiquetaPersona}:</span> <b>${escapar(datos.persona) || '&nbsp;'.repeat(40)}</b></div>
  <div class="campo"><span>Por concepto de:</span> <b>${escapar(datos.motivo) || '&nbsp;'.repeat(40)}</b></div>

  <table>
    <thead><tr><th>Detalle</th><th class="der">Monto</th></tr></thead>
    <tbody>
      ${filas}
      <tr class="total"><td>TOTAL</td><td class="der">${money(total)}</td></tr>
    </tbody>
  </table>

  <div class="firma"><div class="linea-firma">Firma</div></div>

  <div class="pie">
    Documento de control personal. No constituye factura ni documento fiscal
    autorizado por el SAR.
  </div>
</div>
<script>
  window.onload = function () { window.print(); };
</script>
</body></html>`

    const w = window.open('', '_blank')
    if (!w) {
      alert('El navegador bloqueó la ventana. Permite ventanas emergentes e inténtalo de nuevo.')
      return
    }
    w.document.write(html)
    w.document.close()
  }

  if (!editando) {
    return (
      <Vista
        tx={tx}
        datos={datos}
        total={total}
        titulo={titulo}
        etiquetaPersona={etiquetaPersona}
        onVolver={() => setEditando(true)}
        onPDF={generarPDF}
        onClose={onClose}
        areaRef={areaRef}
      />
    )
  }

  return (
    <div className="page stack">
      <div className="between">
        <span className="section-title" style={{ margin: 0 }}>Recibo</span>
        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onClose}>
          Cerrar
        </button>
      </div>

      <div className="card stack">
        <div>
          <label htmlFor="persona">{etiquetaPersona}</label>
          <input
            id="persona" value={datos.persona} onChange={set('persona')}
            placeholder="Nombre completo"
          />
        </div>

        <div>
          <label htmlFor="motivo">Por concepto de</label>
          <input
            id="motivo" value={datos.motivo} onChange={set('motivo')}
            placeholder="Abono a préstamo"
          />
        </div>

        <div className="row" style={{ gap: 12 }}>
          <div className="grow">
            <label htmlFor="fecha">Fecha</label>
            <input id="fecha" type="date" value={datos.fecha} onChange={set('fecha')} />
          </div>
          <div className="grow">
            <label htmlFor="hora">Hora</label>
            <input id="hora" type="time" value={datos.hora} onChange={set('hora')} />
          </div>
        </div>
      </div>

      <div className="card stack">
        <span className="figure-label">Detalle</span>

        {datos.lineas.map((l, i) => (
          <div key={i} className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
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
            {datos.lineas.length > 1 && (
              <button
                className="btn btn-ghost neg"
                style={{ fontSize: 18, padding: '8px 10px' }}
                onClick={() => quitarLinea(i)}
              >
                ×
              </button>
            )}
          </div>
        ))}

        <button className="btn btn-ghost btn-block" style={{ fontSize: 13 }} onClick={agregarLinea}>
          Agregar línea
        </button>

        <div className="between" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <span className="figure-label">Total</span>
          <span className="figure-md num">{money(total)}</span>
        </div>
      </div>

      <button className="btn btn-primary btn-block" onClick={() => setEditando(false)}>
        Ver recibo
      </button>
    </div>
  )
}

function Vista({ tx, datos, total, titulo, etiquetaPersona, onVolver, onPDF, onClose }) {
  return (
    <div className="page stack">
      <div className="between">
        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onVolver}>
          ‹ Editar
        </button>
        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onClose}>
          Cerrar
        </button>
      </div>

      {/* Vista previa clara, parecida a como sale en el PDF */}
      <div style={{
        background: '#fff', color: '#111', padding: 20, borderRadius: 8,
        fontFamily: 'Georgia, serif'
      }}>
        <div style={{
          borderBottom: '2px solid #111', paddingBottom: 8, marginBottom: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12
        }}>
          <span style={{ fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }}>{titulo}</span>
          <span style={{ fontSize: 11, color: '#555', textAlign: 'right' }}>
            No. {referencia(tx)}<br />
            {fechaLarga(datos.fecha)}{datos.hora ? ` · ${datos.hora}` : ''}
          </span>
        </div>

        <div style={{ fontSize: 13, marginBottom: 6 }}>
          <span style={{ color: '#555' }}>{etiquetaPersona}: </span>
          <b>{datos.persona || '—'}</b>
        </div>
        <div style={{ fontSize: 13, marginBottom: 16 }}>
          <span style={{ color: '#555' }}>Por concepto de: </span>
          <b>{datos.motivo || '—'}</b>
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
            {datos.lineas.filter(l => l.detalle || l.monto).map((l, i) => (
              <tr key={i}>
                <td style={{ padding: '6px 2px', borderBottom: '1px solid #eee' }}>
                  {l.detalle}
                </td>
                <td style={{ padding: '6px 2px', borderBottom: '1px solid #eee', textAlign: 'right' }}>
                  {money(Number(String(l.monto).replace(/[\s,]/g, '')) || 0)}
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

      <button className="btn btn-primary btn-block" onClick={onPDF}>
        Generar PDF
      </button>

      <p className="faint" style={{ fontSize: 12 }}>
        Se abre el diálogo de impresión. Para guardarlo, elige Opciones → PDF,
        o toca Compartir para mandarlo por WhatsApp.
      </p>
    </div>
  )
}

// Evita que un nombre con < o & rompa el HTML del PDF.
function escapar(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
