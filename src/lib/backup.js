import { supabase } from './supabase.js'
import { downloadFile } from './transactions.js'
import { todayISO } from './format.js'

const TABLAS = ['accounts', 'categories', 'transactions', 'scheduled_payments']

// Descarga todas las tablas del usuario (Supabase solo devuelve sus
// propias filas) en un archivo JSON. Pagina de 1000 en 1000.
export async function downloadBackup() {
  const datos = { app: 'finanzas', version: 1, creado: new Date().toISOString(), tablas: {} }
  for (const t of TABLAS) {
    const filas = []
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await supabase.from(t).select('*').range(desde, desde + 999)
      if (error) throw new Error(`${t}: ${error.message}`)
      filas.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    datos.tablas[t] = filas
  }
  downloadFile(`finanzas-respaldo-${todayISO()}.json`, JSON.stringify(datos, null, 2), 'application/json')
  return Object.fromEntries(TABLAS.map(t => [t, datos.tablas[t].length]))
}
