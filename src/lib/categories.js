import { supabase } from './supabase.js'

export async function listCategories(kind) {
  let q = supabase.from('categories').select('*').eq('archived', false)
  if (kind) q = q.eq('kind', kind)
  const { data, error } = await q.order('name')
  if (error) throw error
  return data ?? []
}

export async function createCategory({ name, kind, emoji, color }) {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: name.trim(),
      kind,
      emoji: emoji || '📌',
      color: color || '#8b8b93'
    })
    .select()
    .single()
  if (error) throw error
  return data
}
