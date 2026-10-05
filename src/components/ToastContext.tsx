import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastOptions {
  /** One button on the toast — "Undo". Running it dismisses the toast. */
  action?: { label: string; onAction: () => void }
  /** How long it stays, unhovered and unfocused. Longer by default when it carries an action. */
  duration?: number
}

interface Toast {
  id: string
  message: string
  variant: ToastVariant
  options: ToastOptions
}

export interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, options?: ToastOptions) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

const AUTO_DISMISS_MS = 4000
/** Long enough to read the figure and reach for Undo; the server allows two minutes regardless. */
const ACTION_DISMISS_MS = 8000

const variantClasses: Record<ToastVariant, string> = {
  success: 'border-accent-200 bg-accent-50 text-accent-900',
  error: 'border-danger-200 bg-danger-50 text-danger-800',
  info: 'border-neutral-200 bg-white text-neutral-800',
}

/**
 * Toasts v2 (plan Track B, B2): bottom-left on a laptop, along the bottom on a phone — out of the
 * way of the page's own header and where the thumb already is. A toast can carry one action
 * ("Undo"); one that does stays longer, pauses while hovered or focused, and can be closed.
 *
 * Portaled to <body>, beside any open dialog rather than inside the page that a dialog makes inert.
 * On a phone they sit above a screen's bottom action bar, which publishes its height as
 * `--bottom-bar-height` (`InventoryActionBar`).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((message: string, variant: ToastVariant = 'info', options: ToastOptions = {}) => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, variant, options }])
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-stretch gap-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom)+var(--bottom-bar-height,0px))] sm:right-auto sm:items-start sm:px-6 md:pb-6"
          aria-live="polite"
        >
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { action } = toast.options
  const duration = toast.options.duration ?? (action ? ACTION_DISMISS_MS : AUTO_DISMISS_MS)
  const [paused, setPaused] = useState(false)
  const remaining = useRef(duration)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    if (paused) return
    startedAt.current = Date.now()
    const timer = window.setTimeout(onDismiss, remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current = Math.max(1000, remaining.current - (Date.now() - startedAt.current))
    }
  }, [paused, onDismiss])

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`animate-fade-slide-up pointer-events-auto flex w-full items-center gap-3 rounded-md border px-4 py-3 text-sm shadow-paper sm:max-w-md ${variantClasses[toast.variant]}`}
    >
      <p className="min-w-0 flex-1 tabular-nums">{toast.message}</p>
      {action && (
        <>
          <button
            type="button"
            onClick={() => {
              onDismiss()
              action.onAction()
            }}
            className="shrink-0 rounded-sm px-1.5 py-0.5 font-semibold underline underline-offset-2 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {action.label}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 rounded-sm p-0.5 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  )
}
