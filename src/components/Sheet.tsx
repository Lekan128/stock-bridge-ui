import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useDialogBehaviour } from '@/components/useDialogBehaviour'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  /** How wide the side panel is on a laptop; a phone always gets the full-width sheet. */
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const widths = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-xl',
  xl: 'sm:max-w-3xl',
}

/**
 * Where task flows happen (plan Track B, B2): stock in, stock out, count, a new supplier. A sheet
 * rising from the bottom on a phone — in reach of the thumb, with the page it came from still
 * showing above it — and a panel from the right on a laptop, so the list or product stays in
 * view beside the work. Same props as `Modal`, which stays for short confirmations only.
 *
 * Shares `useDialogBehaviour` with `Modal`: focus trap, initial and returned focus, `inert` behind.
 */
export function Sheet({ open, onClose, title, children, footer, size = 'md' }: SheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useDialogBehaviour(dialogRef, open, onClose)

  if (!open) return null

  // Portaled, and submit events stopped at the edge, for the same reasons as `Modal` (a form in
  // here must never nest inside, or submit, the form of the screen that opened it).
  return createPortal(
    <div className="fixed inset-0 z-50" onSubmit={(event) => event.stopPropagation()}>
      <div className="fixed inset-0 bg-neutral-900/40" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`fixed inset-x-0 bottom-0 flex max-h-[92dvh] w-full flex-col rounded-t-xl bg-white shadow-paper animate-sheet-up focus:outline-none sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:rounded-none sm:animate-panel-in ${widths[size]}`}
      >
        {/* The grab bar says "this slides" on a phone; it is decoration, not a control. */}
        <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-neutral-300" />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3 sm:py-4">
          <h2 id={titleId} className="text-base font-semibold text-neutral-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-neutral-200 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
