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

function referencia(fecha) {
  const base = (fecha ?? todayISO()).replace(/-/g, '').slice(2)
  const azar = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base}-${azar}`
}

const TIPOS = [
  { value: 'recibi', label: 'Recibí dinero', titulo: 'RECIBO DE DINERO',   campo: 'Recibí de' },
  { value: 'pague',  label: 'Pagué',         titulo: 'CONSTANCIA DE PAGO', campo: 'Pagué a' }
]

export default function BlankReceipt() {
  const [ref] = useState(() => referencia(todayISO()))
  const [vista, setVista] = useState(false)
  const [generando, setGenerando] = useState(false)
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

  // Dibuja el recibo en un canvas y lo entrega como PNG. Se hace a mano
  // en vez de con una librería para no meter dependencias, y porque el
  // diseño es simple: texto, líneas y una tabla.
  async function generarImagen() {
    setGenerando(true)
    try {
      const filas = d.lineas.filter(l => l.detalle || l.monto)

      const ESCALA = 2            // el doble de resolución, para que no se vea pixelado
      const ANCHO = 720
      const MARGEN = 48
      const ALTO_FILA = 34
      const ALTO = 300 + filas.length * ALTO_FILA + 180

      const canvas = document.createElement('canvas')
      canvas.width = ANCHO * ESCALA
      canvas.height = ALTO * ESCALA
      const c = canvas.getContext('2d')
      c.scale(ESCALA, ESCALA)

      const serif = 'Georgia, "Times New Roman", serif'
      const der = ANCHO - MARGEN

      c.fillStyle = '#ffffff'
      c.fillRect(0, 0, ANCHO, ALTO)
      c.fillStyle = '#111111'
      c.textBaseline = 'alphabetic'

      let y = 62

      // Encabezado
      c.font = `bold 24px ${serif}`
      c.textAlign = 'left'
      c.fillText(tipo.titulo, MARGEN, y)

      c.font = `13px ${serif}`
      c.fillStyle = '#555555'
      c.textAlign = 'right'
      c.fillText(`No. ${ref}`, der, y - 16)
      c.fillText(
        `${fechaLarga(d.fecha)}${d.hora ? ` · ${d.hora}` : ''}`,
        der, y + 2
      )

      y += 16
      c.strokeStyle = '#111111'
      c.lineWidth = 2
      c.beginPath(); c.moveTo(MARGEN, y); c.lineTo(der, y); c.stroke()

      // Datos
      y += 40
      c.textAlign = 'left'
      c.font = `15px ${serif}`
      c.fillStyle = '#555555'
      c.fillText(`${tipo.campo}:`, MARGEN, y)
      c.font = `bold 17px ${serif}`
      c.fillStyle = '#111111'
      c.fillText(d.persona || '—', MARGEN + 130, y)

      y += 32
      c.font = `15px ${serif}`
      c.fillStyle = '#555555'
      c.fillText('Por concepto de:', MARGEN, y)
      c.font = `bold 17px ${serif}`
      c.fillStyle = '#111111'
      c.fillText(d.motivo || '—', MARGEN + 130, y)

      // Tabla
      y += 46
      c.font = `bold 12px ${serif}`
      c.fillStyle = '#111111'
      c.textAlign = 'left'
      c.fillText('DETALLE', MARGEN, y)
      c.textAlign = 'right'
      c.fillText('MONTO', der, y)

      y += 8
      c.lineWidth = 1.5
      c.beginPath(); c.moveTo(MARGEN, y); c.lineTo(der, y); c.stroke()

      c.font = `15px ${serif}`
      for (const l of filas) {
        y += ALTO_FILA
        c.textAlign = 'left'
        c.fillStyle = '#111111'
        c.fillText(recortar(c, l.detalle, ANCHO - MARGEN * 2 - 150), MARGEN, y - 8)
        c.textAlign = 'right'
        c.fillText(money(aNum(l.monto)), der, y - 8)

        c.strokeStyle = '#eeeeee'
        c.lineWidth = 1
        c.beginPath(); c.moveTo(MARGEN, y); c.lineTo(der, y); c.stroke()
      }

      // Total
      y += 6
      c.strokeStyle = '#111111'
      c.lineWidth = 2
      c.beginPath(); c.moveTo(MARGEN, y); c.lineTo(der, y); c.stroke()

      y += 30
      c.font = `bold 19px ${serif}`
      c.fillStyle = '#111111'
      c.textAlign = 'left'
      c.fillText('TOTAL', MARGEN, y)
      c.textAlign = 'right'
      c.fillText(money(total), der, y)

      // Firma
      y += 92
      c.strokeStyle = '#111111'
      c.lineWidth = 1
      c.beginPath(); c.moveTo(der - 210, y); c.lineTo(der, y); c.stroke()
      y += 20
      c.font = `13px ${serif}`
      c.fillStyle = '#555555'
      c.textAlign = 'center'
      c.fillText('Firma', der - 105, y)

      // Pie
      y += 40
      c.strokeStyle = '#dddddd'
      c.beginPath(); c.moveTo(MARGEN, y); c.lineTo(der, y); c.stroke()
      y += 20
      c.font = `11px ${serif}`
      c.fillStyle = '#777777'
      c.textAlign = 'left'
      c.fillText('Documento de control personal. No constituye factura ni', MARGEN, y)
      c.fillText('documento fiscal autorizado por el SAR.', MARGEN, y + 15)

      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
      if (!blob) throw new Error('No se pudo generar la imagen')

      const archivo = new File([blob], `recibo-${ref}.png`, { type: 'image/png' })

      // En iPhone lo mejor es el menú de compartir: permite mandarlo
      // por WhatsApp o guardarlo en Fotos con un toque.
      if (navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({ files: [archivo] })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `recibo-${ref}.png`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        alert('No se pudo generar la imagen: ' + (e?.message ?? ''))
      }
    }
    setGenerando(false)
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

        <Papel d={d} tipo={tipo} total={total} numero={ref} aNum={aNum} />

        <button className="btn btn-primary btn-block" onClick={generarImagen} disabled={generando}>
          {generando ? 'Generando…' : 'Guardar como imagen'}
        </button>

        <p className="faint" style={{ fontSize: 12 }}>
          Se abre el menú de compartir: puedes mandarlo por WhatsApp
          o guardarlo en Fotos.
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

// Corta el texto con puntos suspensivos si no cabe en la columna.
function recortar(ctx, texto, maxAncho) {
  let t = String(texto ?? '')
  if (ctx.measureText(t).width <= maxAncho) return t
  while (t.length > 1 && ctx.measureText(t + '…').width > maxAncho) {
    t = t.slice(0, -1)
  }
  return t + '…'
}

function Papel({ d, tipo, total, numero, aNum }) {
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
          No. {numero}<br />
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
            <th style={{ textAlign: 'left', borderBottom: '1px solid #111',
                         padding: '4px 2px', fontSize: 11 }}>
              DETALLE
            </th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #111',
                         padding: '4px 2px', fontSize: 11 }}>
              MONTO
            </th>
          </tr>
        </thead>
        <tbody>
          {d.lineas.filter(l => l.detalle || l.monto).map((l, i) => (
            <tr key={i}>
              <td style={{ padding: '6px 2px', borderBottom: '1px solid #eee' }}>{l.detalle}</td>
              <td style={{ padding: '6px 2px', borderBottom: '1px solid #eee',
                           textAlign: 'right' }}>
                {money(aNum(l.monto))}
              </td>
            </tr>
          ))}
          <tr>
            <td style={{ borderTop: '2px solid #111', paddingTop: 8,
                         fontWeight: 'bold', fontSize: 15 }}>
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
