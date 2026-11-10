import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Si faltan las variables, createClient lanza al importar y la app
// queda en blanco. Así se puede mostrar un mensaje claro en su lugar.
export const configError = !url || !key
  ? 'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en las variables de entorno.'
  : ''

export const supabase = configError
  ? null
  : createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
