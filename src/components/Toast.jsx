import { createContext, useCallback, useContext, useRef, useState } from 'react'

// Mensajes breves de confirmación ("Movimiento guardado").
const ToastContext = createContext(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('')
  const timer = useRef(null)

  const show = useCallback((texto) => {
    setMsg(texto)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(''), 2200)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastContext.Provider>
  )
}
