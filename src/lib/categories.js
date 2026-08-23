import { supabase } from './supabase.js'

export async function listCategories(kind) {
  let q = supabase.from('categories').select('*').eq('archived', false)
  if (kind) q = q.eq('kind', kind)
  const { data, error } = await q.order('name')
  if (error) throw error
  return data ?? []
}

// Devuelve los padres con sus hijos anidados, para pintar grupos
// en los desplegables y en la pantalla de categorías.
export async function listCategoryTree(kind) {
  const flat = await listCategories(kind)
  const padres = flat.filter(c => !c.parent_id)
  return padres
    .map(p => ({ ...p, children: flat.filter(c => c.parent_id === p.id) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createCategory({ name, kind, emoji, color, parent_id }) {
  const { error } = await supabase.from('categories').insert({
    name: (name ?? '').trim(),
    kind,
    emoji: emoji || '📌',
    color: color || '#8b8b93',
    parent_id: parent_id || null
  })
  if (error) throw error
}

export async function updateCategory(id, { name, emoji, color }) {
  const { error } = await supabase
    .from('categories')
    .update({ name: (name ?? '').trim(), emoji, color })
    .eq('id', id)
  if (error) throw error
}

export async function archiveCategory(id) {
  const { error } = await supabase
    .from('categories').update({ archived: true }).eq('id', id)
  if (error) throw error
}
