import { useEffect, useState } from 'react'
import { listCategoryTree } from '../lib/categories.js'

// Desplegable con grupos. Si un padre tiene hijos, el padre no
// se puede elegir: obliga a bajar al detalle y evita que un gasto
// quede como "Hijo 1" sin decir en qué.
export default function CategorySelect({ kind, value, onChange, id = 'cat' }) {
  const [tree, setTree] = useState([])

  useEffect(() => {
    listCategoryTree(kind).then(setTree).catch(() => setTree([]))
  }, [kind])

  return (
    <select id={id} value={value ?? ''} onChange={onChange}>
      <option value="">Sin categoría</option>
      {tree.map(p =>
        p.children.length === 0 ? (
          <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
        ) : (
          <optgroup key={p.id} label={`${p.emoji} ${p.name}`}>
            {p.children.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </optgroup>
        )
      )}
    </select>
  )
}
