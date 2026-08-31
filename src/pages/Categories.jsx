import { useEffect, useState } from 'react'
import {
  listCategoryTree, createCategory, updateCategory, archiveCategory
} from '../lib/categories.js'

const EMOJIS = ['🧒','👦','👧','📲','🏪','🛒','🚗','🎓','🍎','💊','🧴',
                '🏠','⚡','🌐','🍔','⛽','🎮','💳','📉','📌','💼','🏥'
               '🍬', '☕️', '🍼', '🥛', '🥤', '🧃', '🧉', '🧊', '🍽', '🍯',
               '⚽️', '🎈', '🎮', '🎰', '🛍', '👔', '🩱', '👟', '👠', '🔔',
               '📷', '💻', '🖥', '🖨', '⌨️', '🖱', '📘', '📚', '💸', '💷',
               '💶', '💵', '💴', '🛁', '🪪', '⛔️', '🚼', '🚰', '🔁', '💱',
               '💲', '🏡', '🏠', '🏚', '🏟', '🏛', '🏥', '🏦', '🏩', '🏫',
               '🚑', '🚓', '🚍', '🏍', '🛺', '🚲', '🛣', '🛤', '⌚️', '☔️',
               '💧', '🔥']

export default function Categories() {
  const [kind, setKind] = useState('egreso')
  const [tree, setTree] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(null) // null | 'root' | id del padre

  async function load() {
    setLoading(true); setError('')
    try { setTree(await listCategoryTree(kind)) }
    catch (e) { setError(e.message) }
    setLoading(false)
  }

  useEffect(() => { load() }, [kind])

  return (
    <div className="page stack">
      <div className="row" style={{ gap: 6 }}>
        {['egreso', 'ingreso'].map(k => (
          <button
            key={k}
            className="btn grow"
            style={{
              fontSize: 13,
              borderColor: kind === k ? 'var(--text)' : 'var(--border)',
              color: kind === k ? 'var(--text)' : 'var(--muted)'
            }}
            onClick={() => setKind(k)}
          >
            {k === 'egreso' ? 'Gastos' : 'Ingresos'}
          </button>
        ))}
      </div>

      <button className="btn btn-primary btn-block" onClick={() => setAdding('root')}>
        Nueva categoría
      </button>

      {error && <div className="error">{error}</div>}

      {adding && (
        <Editor
          parentId={adding === 'root' ? null : adding}
          kind={kind}
          onSave={async (v) => {
            try {
              await createCategory({ ...v, kind, parent_id: adding === 'root' ? null : adding })
              setAdding(null); load()
            } catch (e) { setError(e.message) }
          }}
          onCancel={() => setAdding(null)}
        />
      )}

      {loading ? (
        <div className="empty">Cargando…</div>
      ) : (
        tree.map(p => (
          <div key={p.id}>
            <div className="section-title">{p.emoji} {p.name}</div>
            <div className="list">
              <Row
                cat={p}
                isParent
                editing={editing}
                setEditing={setEditing}
                onSaved={load}
                onError={setError}
                onAddChild={() => setAdding(p.id)}
              />
              {p.children.map(c => (
                <Row
                  key={c.id}
                  cat={c}
                  editing={editing}
                  setEditing={setEditing}
                  onSaved={load}
                  onError={setError}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function Row({ cat, isParent, editing, setEditing, onSaved, onError, onAddChild }) {
  const abierto = editing === cat.id

  if (abierto) {
    return (
      <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
        <Editor
          initial={cat}
          onSave={async (v) => {
            try { await updateCategory(cat.id, v); setEditing(null); onSaved() }
            catch (e) { onError(e.message) }
          }}
          onCancel={() => setEditing(null)}
        />
      </div>
    )
  }

  return (
    <div className="list-item" style={{ cursor: 'default' }}>
      <span style={{ fontSize: 17, paddingLeft: isParent ? 0 : 14 }}>{cat.emoji}</span>
      <span className="grow">{cat.name}</span>
      {isParent && (
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 8px' }}
                onClick={onAddChild}>
          + Sub
        </button>
      )}
      <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 8px' }}
              onClick={() => setEditing(cat.id)}>
        Editar
      </button>
      <button className="btn btn-ghost faint" style={{ fontSize: 12, padding: '4px 8px' }}
              onClick={async () => {
                if (!confirm(`¿Archivar "${cat.name}"?`)) return
                try { await archiveCategory(cat.id); onSaved() }
                catch (e) { onError(e.message) }
              }}>
        Archivar
      </button>
    </div>
  )
}

function Editor({ initial, parentId, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '📌')

  return (
    <div className="card stack">
      <div>
        <label htmlFor="cname">
          {parentId ? 'Nombre de la subcategoría' : 'Nombre'}
        </label>
        <input id="cname" value={name} onChange={e => setName(e.target.value)} />
      </div>

      <div>
        <label>Ícono</label>
        <div className="row" style={{ flexWrap: 'wrap', gap: 5 }}>
          {EMOJIS.map(e => (
            <button
              key={e} type="button" className="btn"
              style={{
                padding: '6px 8px', fontSize: 16,
                borderColor: emoji === e ? 'var(--text)' : 'var(--border)'
              }}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost grow" onClick={onCancel}>Cancelar</button>
        <button
          className="btn btn-primary grow"
          onClick={() => name.trim() && onSave({ name, emoji, color: '#8b8b93' })}
        >
          Guardar
        </button>
      </div>
    </div>
  )
}
