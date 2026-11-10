import { useEffect, useState } from 'react'
import {
  listCategoryTree, createCategory, updateCategory, archiveCategory
} from '../lib/categories.js'
import { money, parseAmount } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { useToast } from '../components/Toast.jsx'

// Atajo para los más frecuentes. Para cualquier otro se pega
// directamente en el campo, así no hace falta una cuadrícula enorme.
const RAPIDOS = ['🍎','🛒','🍔','🚗','⛽','🏠','⚡','💧','📶','💊','🎓','👕','🎮','📱','💳','🐶','✈️','🎁','💼','📌']

// Colores para distinguir categorías en las barras del Inicio.
const COLORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948', '#8b8b93']

export default function Categories() {
  const toast = useToast()
  const [kind, setKind] = useState('egreso')
  const [tree, setTree] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(null)

  async function load() {
    setLoading(true); setError('')
    try { setTree(await listCategoryTree(kind)) }
    catch (e) { setError(e.message) }
    setLoading(false)
  }

  useEffect(() => { load() }, [kind])

  // La columna budget existe solo si se aplicó la migración.
  const conPresupuesto = tree.some(c => 'budget' in c)
  const totalPresupuesto = tree.reduce((s, c) => s + (Number(c.budget) || 0), 0)

  return (
    <div className="page stack">
      <div className="seg">
        {[['egreso', 'Gastos'], ['ingreso', 'Ingresos']].map(([k, t]) => (
          <button key={k} className={kind === k ? 'on' : ''}
                  onClick={() => { setKind(k); setEditing(null); setAdding(null) }}>
            {t}
          </button>
        ))}
      </div>

      {kind === 'egreso' && (
        conPresupuesto ? (
          totalPresupuesto > 0 && (
            <div className="card between">
              <span className="figure-label">Presupuesto mensual</span>
              <span className="figure-md num">{money(totalPresupuesto)}</span>
            </div>
          )
        ) : !loading && tree.length > 0 && (
          <div className="notice small">
            Para ponerle presupuesto mensual a cada categoría, ejecuta una vez en Supabase
            (SQL Editor) el archivo <b>supabase/migrations/20261110_presupuestos.sql</b>.
          </div>
        )
      )}

      <button className="btn btn-primary btn-block" onClick={() => { setAdding('root'); setEditing(null) }}>
        <Icon name="plus" size={18} /> Nueva categoría
      </button>

      {error && <div className="error">{error}</div>}

      {adding && (
        <Editor
          esSub={adding !== 'root'}
          onSave={async (v) => {
            try {
              await createCategory({
                ...v, kind,
                parent_id: adding === 'root' ? null : adding
              })
              setAdding(null); load(); toast('Categoría creada')
            } catch (e) { setError(e.message) }
          }}
          onCancel={() => setAdding(null)}
        />
      )}

      {loading ? (
        <div className="empty">Cargando…</div>
      ) : (
        tree.map(p => (
          <div className="list" key={p.id}>
            <Row
              cat={p}
              isParent
              hasChildren={p.children.length > 0}
              conPresupuesto={conPresupuesto && kind === 'egreso'}
              editing={editing}
              setEditing={(id) => { setEditing(id); setAdding(null) }}
              onSaved={() => { load(); toast('Cambios guardados') }}
              onArchived={() => { load(); toast('Categoría archivada') }}
              onError={setError}
              onAddChild={() => { setAdding(p.id); setEditing(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            />
            {p.children.map(c => (
              <Row
                key={c.id}
                cat={c}
                editing={editing}
                setEditing={setEditing}
                onSaved={() => { load(); toast('Cambios guardados') }}
                onArchived={() => { load(); toast('Categoría archivada') }}
                onError={setError}
              />
            ))}
          </div>
        ))
      )}
    </div>
  )
}

function Row({ cat, isParent, hasChildren, conPresupuesto, editing, setEditing, onSaved, onArchived, onError, onAddChild }) {
  const abierto = editing === cat.id
  const [open, setOpen] = useState(false)

  if (abierto) {
    return (
      <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
        <Editor
          initial={cat}
          conPresupuesto={isParent && conPresupuesto}
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
    <>
      <button className="list-item" onClick={() => setOpen(v => !v)} aria-expanded={open}
              style={{ paddingLeft: isParent ? undefined : 30 }}>
        <span className="avatar" style={{
          width: isParent ? 38 : 30, height: isParent ? 38 : 30, fontSize: isParent ? 19 : 15,
          boxShadow: isParent ? `inset 0 -3px 0 ${cat.color || 'transparent'}` : 'none'
        }}>
          {cat.emoji}
        </span>
        <span className="grow">
          <span className="line-1" style={{ fontWeight: isParent ? 600 : 400 }}>{cat.name}</span>
          {isParent && Number(cat.budget) > 0 && (
            <span className="line-2">Presupuesto {money(cat.budget)} al mes</span>
          )}
        </span>
        <Icon name="more" size={18} stroke={2.6} className="faint" />
      </button>

      {open && (
        <div className="list-actions">
          <button className="btn" onClick={() => { setOpen(false); setEditing(cat.id) }}>Editar</button>
          {isParent && (
            <button className="btn" onClick={() => { setOpen(false); onAddChild() }}>+ Subcategoría</button>
          )}
          <button className="btn btn-ghost neg" style={{ marginLeft: 'auto' }}
                  onClick={async () => {
                    const msg = hasChildren
                      ? `¿Archivar "${cat.name}" y todas sus subcategorías?`
                      : `¿Archivar "${cat.name}"?`
                    if (!confirm(msg)) return
                    try { await archiveCategory(cat.id); onArchived() }
                    catch (e) { onError(e.message) }
                  }}>
            Archivar
          </button>
        </div>
      )}
    </>
  )
}

function Editor({ initial, esSub, conPresupuesto, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '📌')
  // Conserva el color que ya tenía; solo las nuevas toman gris.
  const [color, setColor] = useState(initial?.color || '#8b8b93')
  const [budget, setBudget] = useState(Number(initial?.budget) > 0 ? String(initial.budget) : '')
  const [error, setError] = useState('')

  function guardar() {
    if (!name.trim()) { setError('Ponle un nombre'); return }
    const v = { name, emoji: emoji || '📌', color }
    if (conPresupuesto) {
      if (budget.trim() === '') v.budget = null
      else {
        const n = parseAmount(budget)
        if (!(n >= 0)) { setError('El presupuesto no es un número válido'); return }
        v.budget = n || null
      }
    }
    onSave(v)
  }

  return (
    <div className="card stack">
      <div>
        <label htmlFor="cname">
          {esSub ? 'Nombre de la subcategoría' : 'Nombre'}
        </label>
        <input id="cname" value={name} autoFocus onChange={e => setName(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && guardar()} />
      </div>

      <div>
        <label htmlFor="cemoji">Ícono</label>
        <div className="row" style={{ gap: 8 }}>
          <input
            id="cemoji"
            value={emoji}
            onChange={e => setEmoji(e.target.value.trim())}
            style={{ width: 64, fontSize: 22, textAlign: 'center', padding: '8px' }}
          />
          <span className="faint grow small">
            Toca 🌐 en el teclado y elige el que quieras.
          </span>
        </div>

        <div className="row wrap" style={{ gap: 5, marginTop: 8 }}>
          {RAPIDOS.map(e => (
            <button
              key={e} type="button"
              className={'chip' + (emoji === e ? ' on' : '')}
              style={{ padding: '5px 8px', fontSize: 17 }}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {!esSub && (
        <div>
          <label>Color</label>
          <div className="row wrap" style={{ gap: 8 }}>
            {COLORES.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`}
                      style={{
                        width: 30, height: 30, borderRadius: 10, background: c, cursor: 'pointer',
                        border: color === c ? '3px solid var(--text)' : '3px solid transparent'
                      }} />
            ))}
          </div>
        </div>
      )}

      {conPresupuesto && (
        <div>
          <label htmlFor="cbudget">Presupuesto mensual (opcional)</label>
          <input id="cbudget" type="text" inputMode="decimal" placeholder="Sin límite"
                 value={budget} onChange={e => setBudget(e.target.value)} />
          <p className="hint">Incluye lo que gastes en sus subcategorías. En Inicio verás cuánto te queda.</p>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost grow" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary grow" onClick={guardar}>Guardar</button>
      </div>
    </div>
  )
}
