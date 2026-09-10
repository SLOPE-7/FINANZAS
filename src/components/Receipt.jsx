import { money, shortDate } from '../lib/format.js'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
               'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fechaLarga(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES[m - 1]} de ${y}`
}

// Número legible derivado del id y la fecha. No es correlativo
// fiscal: solo sirve para referirse al comprobante.
function referencia(tx) {
  const fecha = (tx.occurred_on ?? '').replace(/-/g, '').slice(2)
  const corto = String(tx.id ?? '').replace(/-/g, '').slice(0, 4).toUpperCase()
  return `${fecha}-${corto}`
}

export default function Receipt({ tx, onClose }) {
  const esIngreso = tx.kind === 'ingreso'
  const esTransferencia = tx.kind === 'transferencia'

  const titulo = esIngreso
    ? 'Comprobante de pago recibido'
    : esTransferencia
      ? 'Comprobante de traslado'
      : 'Comprobante de pago realizado'

  function compartir() {
    const lineas = [
      titulo.toUpperCase(),
      '',
      `Referencia: ${referencia(tx)}`,
      `Fecha: ${fechaLarga(tx.occurred_on)}`,
      `Concepto: ${tx.description || 'Sin concepto'}`,
      `Monto: ${money(tx.amount)}`,
      esTransferencia
        ? `De: ${tx.account?.name ?? ''} → A: ${tx.destino?.name ?? ''}`
        : `${esIngreso ? 'Recibido en' : 'Pagado desde'}: ${tx.account?.name ?? ''}`,
      tx.category ? `Categoría: ${tx.category.name}` : null,
      tx.note ? `Nota: ${tx.note}` : null
    ].filter(Boolean)

    const texto = lineas.join('\n')

    if (navigator.share) {
      navigator.share({ text: texto }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(texto)
      alert('Comprobante copiado')
    }
  }

  return (
    <div className="page stack">
      <div className="between no-print">
        <span className="section-title" style={{ margin: 0 }}>Comprobante</span>
        <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onClose}>
          Cerrar
        </button>
      </div>

      <div className="card stack" id="comprobante" style={{ gap: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{titulo}</div>
          <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>
            Ref. {referencia(tx)}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div className="figure-label">Monto</div>
          <div className={'figure-lg num ' + (esIngreso ? 'pos' : '')}>
            {money(tx.amount)}
          </div>
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <Dato etiqueta="Fecha" valor={fechaLarga(tx.occurred_on)} />
          <Dato etiqueta="Concepto" valor={tx.description || 'Sin concepto'} />

          {esTransferencia ? (
            <>
              <Dato etiqueta="Desde" valor={tx.account?.name ?? '—'} />
              <Dato etiqueta="Hacia" valor={tx.destino?.name ?? '—'} />
            </>
          ) : (
            <Dato
              etiqueta={esIngreso ? 'Recibido en' : 'Pagado desde'}
              valor={tx.account?.name ?? '—'}
            />
          )}

          {tx.category && <Dato etiqueta="Categoría" valor={tx.category.name} />}
          {tx.note && <Dato etiqueta="Nota" valor={tx.note} />}
        </div>

        <p className="faint" style={{
          fontSize: 11,
          borderTop: '1px solid var(--border)',
          paddingTop: 12,
          lineHeight: 1.4
        }}>
          Registro personal. No constituye factura ni documento fiscal.
        </p>
      </div>

      <div className="row no-print" style={{ gap: 8 }}>
        <button className="btn grow" onClick={compartir}>Compartir</button>
        <button className="btn grow" onClick={() => window.print()}>Imprimir</button>
      </div>
    </div>
  )
}

function Dato({ etiqueta, valor }) {
  return (
    <div className="between" style={{ alignItems: 'flex-start', gap: 16 }}>
      <span className="faint" style={{ fontSize: 13, flexShrink: 0 }}>{etiqueta}</span>
      <span style={{ fontSize: 14, textAlign: 'right' }}>{valor}</span>
    </div>
  )
}
