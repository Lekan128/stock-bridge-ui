import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'

export interface ChangeSellingDialogProps {
  open: boolean
  clientName: string
  /** What it is now; the dialog turns it the other way. */
  sellsStock: boolean
  submitting: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (reason: string) => void
}

const MAX_REASON = 500

/**
 * Support turning a company's selling from stock on or off for them (`SELLING_PRICE_PLAN.md` §5.5).
 * The reason is required here as on the server, because the owner is shown it: the screens change
 * under them, and "ProcurePal support turned on selling for you: asked on the phone" is what keeps
 * that from looking like a fault.
 */
export function ChangeSellingDialog({ open, clientName, sellsStock, submitting, error, onCancel, onConfirm }: ChangeSellingDialogProps) {
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (open) setReason('')
  }, [open])
  const trimmed = reason.trim()
  const verb = sellsStock ? 'Turn off selling' : 'Turn on selling'

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={`${verb} for ${clientName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => onConfirm(trimmed)}
            disabled={trimmed.length === 0 || trimmed.length > MAX_REASON}
            loading={submitting}
          >
            {verb}
          </Button>
        </>
      }
    >
      <p className="text-sm text-neutral-600">
        {sellsStock
          ? 'Their selling prices, sales screens and reports will be hidden. Nothing is deleted - turning it back on brings everything back.'
          : 'They will be able to give products a selling price, record sales and see their sales and profit.'}{' '}
        The owner gets a notice in the app with your reason.
      </p>
      <label htmlFor="selling-reason" className="mt-4 block text-sm font-medium text-neutral-900">
        Reason
      </label>
      <textarea
        id="selling-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
        maxLength={MAX_REASON}
        placeholder="Asked on the phone, 19 Oct"
        className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger-600">
          {error}
        </p>
      )}
    </Modal>
  )
}
