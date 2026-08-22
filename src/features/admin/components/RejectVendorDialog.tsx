import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import type { VendorApplication } from '@/features/admin/types'

export interface RejectVendorDialogProps {
  application: VendorApplication | null
  submitting: boolean
  onCancel: () => void
  onConfirm: (reviewNote: string) => void
}

/** Matches `vendor_waitlist_applications.review_note`, so an over-long note is caught here. */
const MAX_NOTE = 500

/**
 * Declining an application, with the note the applicant will read.
 *
 * <h2>Why the note is mandatory in the UI and not only on the server</h2>
 * It is not a field attached to the email — it IS the email. `VendorEmails.applicationRejected` is
 * built around the reviewer's sentence rather than around boilerplate with the sentence appended,
 * because an auto-generated "your application did not meet our criteria" reads as a decision a
 * machine made and tells a business nothing they can act on. The API enforces `@NotBlank`; this
 * disables the button so a reviewer finds out before submitting rather than after.
 *
 * <h2>Rejection is not a door closing</h2>
 * There is deliberately no unique index on the waitlist's email column precisely so a business can
 * come back with better information, and the email says so. The suggestions below are worded to
 * leave that open — each names something the applicant could change — because a reason they cannot
 * act on has the same practical value as no reason at all.
 */
export function RejectVendorDialog({ application, submitting, onCancel, onConfirm }: RejectVendorDialogProps) {
  const [reviewNote, setReviewNote] = useState('')

  // Cleared whenever the target changes, so a note typed for one applicant can never be submitted
  // against the next one the reviewer opens.
  useEffect(() => {
    setReviewNote('')
  }, [application?.id])

  const trimmed = reviewNote.trim()
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_NOTE

  return (
    <Modal
      open={application !== null}
      onClose={onCancel}
      title={application ? `Decline ${application.businessName}` : 'Decline application'}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => onConfirm(trimmed)} disabled={!canSubmit} loading={submitting}>
            Decline application
          </Button>
        </>
      }
    >
      <p className="text-sm text-neutral-600">
        {application?.businessName ?? 'The applicant'} will receive this note by email. They can
        apply again later, so be specific enough that they know what would change our answer.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {[
          'We only onboard registered businesses at the moment.',
          'We are not taking on new suppliers in this category yet.',
          'We could not verify the business details provided.',
          'We need more information about what you supply.',
        ].map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setReviewNote(suggestion)}
            className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <label htmlFor="vendor-review-note" className="mt-4 block text-sm font-medium text-neutral-900">
        Reason
      </label>
      <textarea
        id="vendor-review-note"
        value={reviewNote}
        onChange={(event) => setReviewNote(event.target.value)}
        rows={4}
        maxLength={MAX_NOTE}
        placeholder="Tell them why, and what would change our answer…"
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
      <p className="mt-1 text-xs text-neutral-400">
        {trimmed.length === 0 ? 'A reason is required.' : `${reviewNote.length} / ${MAX_NOTE}`}
      </p>
    </Modal>
  )
}
