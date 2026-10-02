import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  // Added for the stock-in/stock-out redesign (multi-vendor inventory) — the advanced disclosure's
  // vendor picker + lot allocation table needs more room than `lg`'s `max-w-2xl` comfortably
  // gives. `size` stays optional and every existing caller keeps its own value, so this is
  // additive only.
  xl: 'max-w-4xl',
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  // Portaled to document.body, not rendered in place. A modal that wraps its own <form>
  // (VendorFormModal, AddressFormModal, ...) can be opened from inside another screen's <form> —
  // SupplierField does exactly this. Rendered in place, that <form> would land in the live DOM as
  // a CHILD of whatever form opened it, which is invalid HTML (a <form> cannot contain a <form>)
  // and was observed, live, to make the browser's own native form-submission machinery misfire:
  // clicking the inner form's submit button triggered a native GET navigation of the CURRENT page
  // with the inner form's fields as a query string — not React's onSubmit at all — which is what
  // wiped out whatever the outer form already had typed into it. The portal moves the modal's DOM
  // out from under the opener's <form> entirely, so there is no nested <form> for the browser to
  // get confused by, regardless of what screen opens it.
  //
  // This does NOT, by itself, stop React's own synthetic event bubbling — React bubbles a
  // portaled child's events along the REACT tree, not the DOM tree, so a `submit` fired in here
  // would still reach an ancestor form's `onSubmit` in React's eyes. `stopPropagation` below is
  // what actually closes that second path.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      onSubmit={(event) => event.stopPropagation()}
    >
      <div className="fixed inset-0 bg-neutral-900/40" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-fade-slide-up relative flex max-h-full w-full flex-col rounded-lg bg-white shadow-lg ${sizes[size]}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex shrink-0 justify-end gap-2 border-t border-neutral-200 px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
