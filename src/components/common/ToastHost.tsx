import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

type Toast = { id: number; message: string }

const ToastContext = createContext<(msg: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])
    const show = useCallback((message: string) => {
        const id = Date.now() + Math.random()
        setToasts((t) => [...t, { id, message }])
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000)
    }, [])
    return (
        <ToastContext.Provider value={show}>
            {children}
            <div className="toast toast-end">
                {toasts.map((t) => (
                    <div key={t.id} className="alert alert-info">
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


