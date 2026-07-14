import { createContext, useCallback, useState, type ReactNode } from 'react'

export type ToastVariant = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

export interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

const AUTO_DISMISS_MS = 4000

const variantClasses: Record<ToastVariant, string> = {
  success: 'border-accent-200 bg-accent-50 text-accent-800',
  error: 'border-danger-200 bg-danger-50 text-danger-700',
  info: 'border-neutral-200 bg-white text-neutral-700',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, AUTO_DISMISS_MS)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`animate-fade-slide-up pointer-events-auto w-full max-w-sm rounded-md border px-4 py-3 text-sm shadow-sm ${variantClasses[toast.variant]}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
