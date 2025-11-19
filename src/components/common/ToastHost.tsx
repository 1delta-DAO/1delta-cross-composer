import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

type ToastType = "error" | "info" | "success" | "warning"

type Toast = { id: number; message: string; type: ToastType }

type ToastContextType = {
  show: (message: string, type?: ToastType) => void
  showError: (message: string) => void
  showSuccess: (message: string) => void
  showInfo: (message: string) => void
  showWarning: (message: string) => void
}

const ToastContext = createContext<ToastContextType>({
  show: () => {},
  showError: () => {},
  showSuccess: () => {},
  showInfo: () => {},
  showWarning: () => {},
})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const show = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000)
  }, [])
  const showError = useCallback((message: string) => show(message, "error"), [show])
  const showSuccess = useCallback((message: string) => show(message, "success"), [show])
  const showInfo = useCallback((message: string) => show(message, "info"), [show])
  const showWarning = useCallback((message: string) => show(message, "warning"), [show])

  const getAlertClass = (type: ToastType) => {
    switch (type) {
      case "error":
        return "alert-error"
      case "success":
        return "alert-success"
      case "warning":
        return "alert-warning"
      default:
        return "alert-info"
    }
  }

  return (
    <ToastContext.Provider value={{ show, showError, showSuccess, showInfo, showWarning }}>
      {children}
      <div className="toast toast-end toast-bottom z-50">
        {toasts.map((t) => (
          <div key={t.id} className={`alert ${getAlertClass(t.type)} shadow-lg`}>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
