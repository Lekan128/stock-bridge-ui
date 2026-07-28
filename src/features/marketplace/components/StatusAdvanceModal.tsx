import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import type { StatusAction } from '@/features/marketplace/formatters'

export interface StatusAdvanceModalProps {
  action: StatusAction | null
  orderNumber: string
  customerName: string
  submitting: boolean
  onConfirm: (note: string) => void
  onCancel: () => void
}

const NOTE_MAX_LENGTH = 500

/**
 * The confirm step for a fulfilment transition.
 *
 * It is a purpose-built modal rather than the shared `ConfirmDialog` for one reason: every
 * transition may carry a note, and that note is *customer-facing* — it lands on the status event
 * the buyer's tracking timeline renders ("delayed at Berger, out again tomorrow"). Dropping the
 * field to reuse a component would remove the cheapest way ProcurePal has to keep a customer
 * informed. Irreversible transitions additionally get a warning callout, and cancelling requires
 * the note, because a cancellation with no stated reason is useless to whoever reads it next.
 */
export function StatusAdvanceModal({
  action,
  orderNumber,
  customerName,
  submitting,
  onConfirm,
  onCancel,
}: StatusAdvanceModalProps) {
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)

  // Reset between openings — a note typed for a cancellation must not follow the operator into
  // the next transition they open.
  useEffect(() => {
    setNote('')
    setTouched(false)
  }, [action])

  if (!action) return null

  const noteMissing = action.requiresNote && note.trim().length === 0
  const showNoteError = touched && noteMissing

  return (
    <Modal
      open
      onClose={onCancel}
      title={action.label}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Back
          </Button>
          <Button
            variant={action.variant}
            loading={submitting}
            disabled={noteMissing}
            // A disabled button must say why (UX bar) — the title carries the reason for pointer
            // users and the inline error carries it for everyone else.
            title={noteMissing ? 'Enter a reason before cancelling this order' : undefined}
            onClick={() => {
              setTouched(true)
              if (noteMissing) return
              onConfirm(note.trim())
            }}
          >
            {action.label}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-600">
          {action.description}
        </p>

        {action.irreversible && (
          <div className="flex items-start gap-2 rounded-md border border-warning-200 bg-warning-50 px-3 py-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
            <p className="text-sm text-warning-800">
              This cannot be undone. {orderNumber} belongs to {customerName}.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="status-note" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Note {action.requiresNote ? '' : <span className="font-normal text-neutral-400">(optional)</span>}
          </label>
          <textarea
            id="status-note"
            rows={3}
            value={note}
            maxLength={NOTE_MAX_LENGTH}
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={showNoteError || undefined}
            aria-describedby={showNoteError ? 'status-note-error' : 'status-note-hint'}
            placeholder={
              action.status === 'CANCELLED'
                ? 'Why is this order being cancelled?'
                : 'Anything the customer should know, e.g. “leaving the warehouse at 2pm”'
            }
            className={`w-full rounded-md border px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:outline-none ${
              showNoteError
                ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-100'
                : 'border-neutral-200 focus:border-primary-500 focus:ring-primary-100'
            }`}
          />
          {showNoteError ? (
            <p id="status-note-error" role="alert" className="mt-1.5 text-xs text-danger-600">
              Enter a reason — the customer sees this on their order.
            </p>
          ) : (
            <p id="status-note-hint" className="mt-1.5 text-xs text-neutral-500">
              The customer sees this on their order tracking.
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
