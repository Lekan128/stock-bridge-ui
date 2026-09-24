import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Modal } from '@/components/Modal'
import { expectedCopy } from '@/features/expected/copy'
import type { ExpectedDelivery } from '@/features/expected/types'

export interface CancelExpectedDialogProps {
  /** The record being called off, or null when the dialog is closed. */
  expected: ExpectedDelivery | null
  cancelling: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}

/**
 * "Call this one off?" — an in-app dialog, never the browser's own `confirm()`.
 *
 * `confirm()` blocks the whole tab, cannot be styled, cannot say which record it means, and on a
 * phone drops a system sheet with the site's hostname in it over a screen the user was reading.
 * This one names the record in the body, and says the one thing somebody is actually worried
 * about before they press it: nothing in their stock changes.
 */
export function CancelExpectedDialog({
  expected,
  cancelling,
  error,
  onConfirm,
  onClose,
}: CancelExpectedDialogProps) {
  return (
    <Modal
      open={expected != null}
      onClose={() => {
        if (!cancelling) onClose()
      }}
      title={expectedCopy.cancel.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={cancelling}>
            {expectedCopy.cancel.keep}
          </Button>
          <Button variant="danger" loading={cancelling} onClick={onConfirm}>
            {expectedCopy.cancel.confirm}
          </Button>
        </>
      }
    >
      {expected && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-neutral-900">{expected.title}</p>
          <p className="text-sm text-neutral-600">{expectedCopy.cancel.body}</p>
          {error && <ErrorState variant="inline" message={error} />}
        </div>
      )}
    </Modal>
  )
}
