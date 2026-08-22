import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import type { ModerationProduct } from '@/features/admin/types'

export interface RejectListingDialogProps {
  product: ModerationProduct | null
  submitting: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
}

/** Kept short enough to read, long enough to be specific. Matches `products.rejection_reason`. */
const MAX_REASON = 1000

/**
 * Rejecting a listing, with the reason the vendor will read.
 *
 * <h2>Why the reason is mandatory in the UI and not only on the server</h2>
 * VENDOR_RESEARCH.md Section C item 4 asks for a rejection reason and a resubmission loop
 * together, because they are one mechanism: a vendor told "no" with no explanation cannot fix
 * anything, so the rejection converts straight into a support ticket and the queue becomes a
 * source of work rather than a filter on it. The API enforces `@NotBlank`; this disables the
 * button so a reviewer finds out before submitting rather than after.
 *
 * The suggestions are one click each because the common rejections are the same three every time,
 * and a reviewer working a queue at speed will otherwise type nothing useful.
 */
export function RejectListingDialog({ product, submitting, onCancel, onConfirm }: RejectListingDialogProps) {
  const [reason, setReason] = useState('')

  // Cleared whenever the target changes, so a reason typed for one listing can never be submitted
  // against the next one the reviewer opens.
  useEffect(() => {
    setReason('')
  }, [product?.id])

  const trimmed = reason.trim()
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_REASON

  return (
    <Modal
      open={product !== null}
      onClose={onCancel}
      title={product ? `Reject “${product.name}”` : 'Reject listing'}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => onConfirm(trimmed)} disabled={!canSubmit} loading={submitting}>
            Reject listing
          </Button>
        </>
      }
    >
      <p className="text-sm text-neutral-600">
        {product?.sellerName ?? 'The seller'} will see this reason and can fix the listing and resubmit it. Be specific
        enough that they know what to change.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {[
          'The product images are too low quality to list.',
          'The description does not match the product name.',
          'This product cannot be sold on ProcurePaddy.',
          'The price looks like an error — please confirm it.',
        ].map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setReason(suggestion)}
            className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <label htmlFor="rejection-reason" className="mt-4 block text-sm font-medium text-neutral-900">
        Reason
      </label>
      <textarea
        id="rejection-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={4}
        maxLength={MAX_REASON}
        placeholder="Tell the seller what to fix…"
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
      <p className="mt-1 text-xs text-neutral-400">
        {trimmed.length === 0 ? 'A reason is required.' : `${reason.length} / ${MAX_REASON}`}
      </p>
    </Modal>
  )
}
