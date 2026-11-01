import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'info'

/** A button on a toast. With `choices`, it opens a short list above it and the one picked runs instead. */
export interface ToastAction {
  label: string
  onAction: () => void
  choices?: { label: string; onSelect: () => void }[]
}

export interface ToastOptions {
  /** One button on the toast — "Undo". Running it dismisses the toast. */
  action?: ToastAction
  /** A second, after it ("Tell Amaka on WhatsApp" · "Undo"). */
  secondaryAction?: ToastAction
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
 * Portaled to <body>. Below dialogs (z-40 under their z-50) and above bottom bars (z-30): an open
 * sheet makes everything else inert, so a toast drawn over it would only hide the sheet's fields
 * behind a button nobody can press.
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
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-stretch gap-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom)+var(--bottom-bar-height,0px))] sm:right-auto sm:items-start sm:px-6 md:pb-6"
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
  const { action, secondaryAction } = toast.options
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
          <ToastActionButton action={action} onDismiss={onDismiss} onOpenChange={setPaused} />
          {secondaryAction && <ToastActionButton action={secondaryAction} onDismiss={onDismiss} onOpenChange={setPaused} />}
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

/** One action: a button, or - with choices - a button that opens a short list above it (the toast waits meanwhile). */
function ToastActionButton({
  action,
  onDismiss,
  onOpenChange,
}: {
  action: ToastAction
  onDismiss: () => void
  onOpenChange: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const className =
    'shrink-0 rounded-sm px-1.5 py-0.5 font-semibold underline underline-offset-2 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'
  if (!action.choices || action.choices.length === 0) {
    return (
      <button
        type="button"
        onClick={() => {
          onDismiss()
          action.onAction()
        }}
        className={className}
      >
        {action.label}
      </button>
    )
  }
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((was) => !was)
          onOpenChange(!open)
        }}
        className={className}
      >
        {action.label}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 bottom-full mb-2 flex min-w-[12rem] flex-col rounded-md border border-neutral-200 bg-white p-1 text-neutral-800 shadow-lg">
          {action.choices.map((choice) => (
            <button
              key={choice.label}
              type="button"
              role="menuitem"
              onClick={() => {
                onDismiss()
                choice.onSelect()
              }}
              className="flex min-h-11 items-center rounded-md px-3 text-left text-sm hover:bg-neutral-50"
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
