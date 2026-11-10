import { createContext, useContext } from 'react'
import { setHideAmounts } from './format.js'

// Preferencias de este dispositivo: tema y modo privado.
// Se guardan en el navegador; si no se puede, se usan los valores por defecto.
const KEY = 'finanzas_prefs'
const DEFAULTS = { theme: 'auto', hide: false }

export function loadPrefs() {
  try {
    return { ...DEFAULTS, ...JSON.parse(window.localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function savePrefs(p) {
  try { window.localStorage.setItem(KEY, JSON.stringify(p)) } catch {}
}

// Aplica las preferencias fuera de React: tema en <html> y modo privado
// en el formateador de dinero.
export function applyPrefs(p) {
  setHideAmounts(p.hide)
  const root = document.documentElement
  if (p.theme === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', p.theme)
  const oscuro = p.theme === 'dark' ||
    (p.theme === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', oscuro ? '#0b0b0c' : '#f6f6f4')
}

export const PrefsContext = createContext({ prefs: DEFAULTS, setPrefs: () => {} })
export const usePrefs = () => useContext(PrefsContext)
