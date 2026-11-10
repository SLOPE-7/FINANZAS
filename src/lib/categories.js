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
  const ids = new Set(flat.map(c => c.id))
  // Una subcategoría cuyo padre está archivado se muestra suelta,
  // para que no desaparezca de los desplegables.
  const padres = flat.filter(c => !c.parent_id || !ids.has(c.parent_id))
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

export async function updateCategory(id, { name, emoji, color, budget }) {
  const cambios = { name: (name ?? '').trim(), emoji }
  // El presupuesto solo existe si se aplicó la migración de presupuestos.
  if (budget !== undefined) cambios.budget = budget
  // Solo se toca el color si viene: antes cada edición lo pisaba con gris.
  if (color) cambios.color = color
  const { error } = await supabase
    .from('categories')
    .update(cambios)
    .eq('id', id)
  if (error) throw translateBudget(error)
}

function translateBudget(error) {
  if (/budget/.test(error.message ?? '')) {
    return new Error('Para usar presupuestos, ejecuta en Supabase el archivo supabase/migrations/20261110_presupuestos.sql')
  }
  return error
}

// Archivar un padre archiva también sus subcategorías.
export async function archiveCategory(id) {
  const { error } = await supabase
    .from('categories').update({ archived: true })
    .or(`id.eq.${id},parent_id.eq.${id}`)
  if (error) throw error
}
