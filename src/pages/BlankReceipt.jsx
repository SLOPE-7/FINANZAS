import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { moneyExact as money, todayISO, parseAmount, longDate as fechaLarga, nowHHMM as horaActual } from '../lib/format.js'
import { listAccounts } from '../lib/accounts.js'

function referencia(fecha) {
  const base = (fecha ?? todayISO()).replace(/-/g, '').slice(2)
  const azar = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base}-${azar}`
}

// Cada tipo decide qué campos extra se piden y cómo se titula el papel.
const TIPOS = [
  {
    value: 'recibi',
    label: 'Recibí',
    titulo: 'RECIBO DE DINERO',
    campo: 'Recibí de',
    leyenda: null
  },
  {
    value: 'pague',
    label: 'Pagué',
    titulo: 'CONSTANCIA DE PAGO',
    campo: 'Pagué a',
    leyenda: null
  },
  {
    value: 'presté',
    label: 'Presté',
    titulo: 'CONSTANCIA DE PRÉSTAMO',
    campo: 'Presté a',
    prestamo: true,
    leyenda: 'El deudor reconoce haber recibido la cantidad indicada y se compromete a devolverla en las condiciones señaladas.'
  },
  {
    value: 'custodia',
    label: 'Guardo',
    titulo: 'CONSTANCIA DE DINERO EN CUSTODIA',
    campo: 'Dinero de',
    custodia: true,
    leyenda: 'El dinero descrito pertenece a la persona indicada y se mantiene bajo resguardo, disponible para su entrega.'
  }
]

// El borrador se guarda en el navegador para no perderlo al cambiar
// de pestaña o cerrar la app a medio llenar.
const BORRADOR = 'finanzas_recibo_borrador'
function leerBorrador() {
  try { return JSON.parse(window.localStorage.getItem(BORRADOR) || 'null') } catch { return null }
}
function guardarBorrador(x) {
  try { window.localStorage.setItem(BORRADOR, JSON.stringify(x)) } catch {}
}

export default function BlankReceipt() {
  const borrador = leerBorrador()
  const [ref, setRef] = useState(() => borrador?.ref ?? referencia(todayISO()))
  const [vista, setVista] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [cuentas, setCuentas] = useState([])

  const [d, setD] = useState(() => borrador?.d ?? {
    tipo: 'recibi',
    persona: '',
    motivo: '',
    fecha: todayISO(),
    hora: horaActual(),
    vence: '',
    interes: '',
    resguardo: '',
    lineas: [{ detalle: '', monto: '' }]
  })

  useEffect(() => {
    listAccounts().then(setCuentas).catch(() => setCuentas([]))
  }, [])

  useEffect(() => { guardarBorrador({ ref, d }) }, [ref, d])

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

  const aNum = (x) => parseAmount(x) || 0
  const total = d.lineas.reduce((s, l) => s + aNum(l.monto), 0)

  // Líneas de datos que van bajo el encabezado, ya resueltas
  // según el tipo. Se usan igual en la vista previa y en la imagen.
  function camposExtra() {
    const out = []
    if (tipo.prestamo) {
      if (d.vence) out.push(['Fecha acordada de pago', fechaLarga(d.vence)])
      if (d.interes.trim()) out.push(['Interés pactado', d.interes.trim()])
    }
    if (tipo.custodia && d.resguardo.trim()) {
      out.push(['Resguardado en', d.resguardo.trim()])
    }
    return out
  }

  function limpiar() {
    if (!confirm('¿Vaciar el recibo?')) return
    setD({
      tipo: d.tipo, persona: '', motivo: '',
      fecha: todayISO(), hora: horaActual(),
      vence: '', interes: '', resguardo: '',
      lineas: [{ detalle: '', monto: '' }]
    })
    // Un recibo nuevo necesita su propio número.
    setRef(referencia(todayISO()))
    setVista(false)
  }

  async function generarImagen() {
    setGenerando(true)
    try {
      const filas = d.lineas.filter(l => l.detalle || l.monto)
      const extras = camposExtra()

      const ESCALA = 2
      const ANCHO = 720
      const MARGEN = 48
      const ALTO_FILA = 34
      const serif = 'Georgia, "Times New Roman", serif'
      const der = ANCHO - MARGEN
      const anchoValor = der - (MARGEN + 160)

      // Se mide la leyenda antes de fijar el alto: si es larga ocupa
      // varias líneas y antes se cortaba el pie de la imagen.
      const canvas = document.createElement('canvas')
      let c = canvas.getContext('2d')
      c.font = `italic 13px ${serif}`
      const lineasLeyenda = tipo.leyenda ? envolver(c, tipo.leyenda, ANCHO - MARGEN * 2) : []
      const altoLeyenda = lineasLeyenda.length ? 40 + lineasLeyenda.length * 19 : 0
      const ALTO = 300 + extras.length * 30 + filas.length * ALTO_FILA + altoLeyenda + 180

      canvas.width = ANCHO * ESCALA
      canvas.height = ALTO * ESCALA
      c = canvas.getContext('2d')
      c.scale(ESCALA, ESCALA)

      c.fillStyle = '#ffffff'
      c.fillRect(0, 0, ANCHO, ALTO)
      c.fillStyle = '#111111'
      c.textBaseline = 'alphabetic'

      let y = 62

      c.font = `bold 22px ${serif}`
      c.textAlign = 'left'
      c.fillText(tipo.titulo, MARGEN, y)

      c.font = `13px ${serif}`
      c.fillStyle = '#555555'
      c.textAlign = 'right'
      c.fillText(`No. ${ref}`, der, y - 16)
      c.fillText(`${fechaLarga(d.fecha)}${d.hora ? ` · ${d.hora}` : ''}`, der, y + 2)

      y += 16
      c.strokeStyle = '#111111'
      c.lineWidth = 2
      c.beginPath(); c.moveTo(MARGEN, y); c.lineTo(der, y); c.stroke()

      y += 40
      c.textAlign = 'left'
      c.font = `15px ${serif}`
      c.fillStyle = '#555555'
      c.fillText(`${tipo.campo}:`, MARGEN, y)
      c.font = `bold 17px ${serif}`
      c.fillStyle = '#111111'
      c.fillText(recortar(c, d.persona || '—', anchoValor), MARGEN + 160, y)

      y += 30
      c.font = `15px ${serif}`
      c.fillStyle = '#555555'
      c.fillText('Por concepto de:', MARGEN, y)
      c.font = `bold 17px ${serif}`
      c.fillStyle = '#111111'
      c.fillText(recortar(c, d.motivo || '—', anchoValor), MARGEN + 160, y)

      for (const [etiqueta, valor] of extras) {
        y += 30
        c.font = `15px ${serif}`
        c.fillStyle = '#555555'
        c.fillText(`${etiqueta}:`, MARGEN, y)
        c.font = `bold 17px ${serif}`
        c.fillStyle = '#111111'
        c.fillText(recortar(c, valor, anchoValor), MARGEN + 160, y)
      }

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

      if (lineasLeyenda.length) {
        y += 40
        c.font = `italic 13px ${serif}`
        c.fillStyle = '#333333'
        c.textAlign = 'left'
        for (const linea of lineasLeyenda) {
          c.fillText(linea, MARGEN, y)
          y += 19
        }
      }

      y += 70
      c.strokeStyle = '#111111'
      c.lineWidth = 1
      c.beginPath(); c.moveTo(der - 210, y); c.lineTo(der, y); c.stroke()
      y += 20
      c.font = `13px ${serif}`
      c.fillStyle = '#555555'
      c.textAlign = 'center'
      c.fillText('Firma', der - 105, y)

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

        <Papel
          d={d} tipo={tipo} total={total} numero={ref}
          aNum={aNum} extras={camposExtra()}
        />

        <button className="btn btn-primary btn-block btn-lg" onClick={generarImagen} disabled={generando}>
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
      <div className="between">
        <Link to="/mas" className="btn btn-ghost btn-sm">‹ Más</Link>
        <button className="btn btn-ghost btn-sm" onClick={limpiar}>Vaciar</button>
      </div>

      <div className="seg">
        {TIPOS.map(t => (
          <button
            key={t.value}
            className={d.tipo === t.value ? 'on' : ''}
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
            placeholder={tipo.prestamo ? 'Préstamo personal' : 'Abono a préstamo'}
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

      {tipo.prestamo && (
        <div className="card stack">
          <span className="figure-label">Condiciones del préstamo</span>

          <div>
            <label htmlFor="vence">Fecha acordada de pago</label>
            <input id="vence" type="date" value={d.vence} onChange={set('vence')} />
          </div>

          <div>
            <label htmlFor="interes">Interés pactado</label>
            <input
              id="interes" value={d.interes} onChange={set('interes')}
              placeholder="5% mensual, o Sin interés"
            />
          </div>
        </div>
      )}

      {tipo.custodia && (
        <div className="card stack">
          <span className="figure-label">Resguardo</span>

          <div>
            <label htmlFor="resguardo">¿Dónde lo tienes?</label>
            <input
              id="resguardo" value={d.resguardo} onChange={set('resguardo')}
              placeholder="Efectivo, BAC, …"
              list="lista-cuentas"
            />
            <datalist id="lista-cuentas">
              {cuentas.map(c => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>
        </div>
      )}

      <div className="card stack">
        <span className="figure-label">
          {tipo.custodia ? 'Entregas' : 'Detalle'}
        </span>

        {d.lineas.map((l, i) => (
          <div key={i} className="row" style={{ gap: 8 }}>
            <div className="grow">
              <input
                value={l.detalle}
                onChange={e => setLinea(i, 'detalle', e.target.value)}
                placeholder={tipo.custodia ? 'Entrega del 12 de agosto' : 'Descripción'}
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

function recortar(ctx, texto, maxAncho) {
  let t = String(texto ?? '')
  if (ctx.measureText(t).width <= maxAncho) return t
  while (t.length > 1 && ctx.measureText(t + '…').width > maxAncho) {
    t = t.slice(0, -1)
  }
  return t + '…'
}

// Parte un párrafo en líneas que quepan en el ancho dado.
function envolver(ctx, texto, maxAncho) {
  const palabras = String(texto ?? '').split(' ')
  const lineas = []
  let actual = ''
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p
    if (ctx.measureText(prueba).width > maxAncho && actual) {
      lineas.push(actual)
      actual = p
    } else {
      actual = prueba
    }
  }
  if (actual) lineas.push(actual)
  return lineas
}

function Papel({ d, tipo, total, numero, aNum, extras }) {
  return (
    <div style={{
      background: '#fff', color: '#111', padding: 20, borderRadius: 8,
      fontFamily: 'Georgia, serif'
    }}>
      <div style={{
        borderBottom: '2px solid #111', paddingBottom: 8, marginBottom: 16,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12
      }}>
        <span style={{ fontSize: 15, fontWeight: 'bold', letterSpacing: 1 }}>{tipo.titulo}</span>
        <span style={{ fontSize: 11, color: '#555', textAlign: 'right' }}>
          No. {numero}<br />
          {fechaLarga(d.fecha)}{d.hora ? ` · ${d.hora}` : ''}
        </span>
      </div>

      <div style={{ fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: '#555' }}>{tipo.campo}: </span>
        <b>{d.persona || '—'}</b>
      </div>
      <div style={{ fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: '#555' }}>Por concepto de: </span>
        <b>{d.motivo || '—'}</b>
      </div>

      {extras.map(([etiqueta, valor], i) => (
        <div key={i} style={{ fontSize: 13, marginBottom: 6 }}>
          <span style={{ color: '#555' }}>{etiqueta}: </span>
          <b>{valor}</b>
        </div>
      ))}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 14 }}>
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

      {tipo.leyenda && (
        <p style={{ fontSize: 12, fontStyle: 'italic', color: '#333', marginTop: 16 }}>
          {tipo.leyenda}
        </p>
      )}

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
