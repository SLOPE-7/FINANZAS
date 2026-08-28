import { useEffect, useState } from 'react'
import { money } from '../lib/format.js'
import {
  listAccounts, getAccount, typeLabel,
  archiveAccount, unarchiveAccount, deleteAccount
} from '../lib/accounts.js'
import AccountForm from '../components/AccountForm.jsx'

export default function Accounts() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [showArchived, setShowArchived] = useState(false)

  async function load() {
    setLoading(true); setError('')
    try {
      setItems(await listAccounts({ includeArchived: showArchived }))
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [showArchived])

  // Trae la fila real de accounts, no la de la vista: la vista es
  // un cálculo y no sirve para rellenar el formulario de edición.
  async function abrirEdicion(id) {
    setError('')
    try {
      setEditing(await getAccount(id))
    } catch (e) {
      setError(e.message)
    }
  }

  const activos = items.filter(a => !a.archived)
  const total = activos.reduce((s, a) => s + Number(a.balance), 0)
  const enTarjetas = activos
    .filter(a => a.type === 'tarjeta')
    .reduce((s, a) => s + Number(a.balance), 0)

  if (editing) {
    return (
      <AccountForm
        account={editing === 'new' ? null : editing}
        onDone={() => { setEditing(null); load() }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="page stack">
      <div className="card">
        <div className="figure-label">Patrimonio neto</div>
        <div className={'figure-lg num ' + (total < 0 ? 'neg' : '')}>
          {money(total)}
        </div>
        {enTarjetas < 0 && (
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Incluye {money(Math.abs(enTarjetas))} de deuda en tarjetas
          </div>
        )}
      </div>

      <button className="btn btn-primary btn-block" onClick={() => setEditing('new')}>
        Agregar cuenta
      </button>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="empty">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="list">
          <div className="empty">
            Todavía no tienes cuentas.<br />
            Agrega tu banco, tu efectivo y tus tarjetas.
          </div>
        </div>
      ) : (
        <div className="list">
          {items.map(a => (
            <AccountRow
              key={a.id}
              account={a}
              onEdit={() => abrirEdicion(a.id)}
              onArchive={async () => { await archiveAccount(a.id); load() }}
              onUnarchive={async () => { await unarchiveAccount(a.id); load() }}
              onDelete={async () => {
                if (!confirm(`¿Borrar "${a.name}"?`)) return
                try { await deleteAccount(a.id); load() }
                catch (e) { setError(e.message) }
              }}
            />
          ))}
        </div>
      )}

      <button
        className="btn btn-ghost btn-block"
        onClick={() => setShowArchived(v => !v)}
      >
        {showArchived ? 'Ocultar archivadas' : 'Ver archivadas'}
      </button>
    </div>
  )
}

function AccountRow({ account: a, onEdit, onArchive, onUnarchive, onDelete }) {
  const [open, setOpen] = useState(false)
  const saldo = Number(a.balance)
  const esTarjeta = a.type === 'tarjeta'
  const claseSaldo = esTarjeta ? '' : (saldo < 0 ? 'neg' : '')

  let usoTexto = null
  if (esTarjeta && a.credit_limit > 0) {
    const usado = Math.max(0, -saldo)
    const pct = Math.round((usado / Number(a.credit_limit)) * 100)
    usoTexto = `${money(Number(a.credit_limit) - usado)} disponible · ${pct}% usado`
  }

  return (
    <>
      <button className="list-item" onClick={() => setOpen(v => !v)}>
        <span style={{ fontSize: 20 }}>{a.emoji}</span>
        <span className="grow">
          <span style={{ display: 'block' }}>
            {a.name}
            {a.archived && <span className="faint" style={{ fontSize: 12 }}> · archivada</span>}
          </span>
          <span className="faint" style={{ fontSize: 12 }}>
            {usoTexto ?? typeLabel(a.type)}
          </span>
        </span>
        <span className={'figure-md num ' + claseSaldo}>{money(saldo)}</span>
      </button>

      {open && (
        <div
          className="row"
          style={{ padding: '10px 16px', gap: 8, borderBottom: '1px solid var(--border)' }}
        >
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onEdit}>
            Editar
          </button>
          {a.archived ? (
            <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onUnarchive}>
              Restaurar
            </button>
          ) : (
            <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onArchive}>
              Archivar
            </button>
          )}
          <button
            className="btn btn-ghost neg"
            style={{ fontSize: 13, marginLeft: 'auto' }}
            onClick={onDelete}
          >
            Borrar
          </button>
        </div>
      )}
    </>
  )
}
