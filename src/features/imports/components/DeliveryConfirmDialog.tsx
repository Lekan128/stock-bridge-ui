import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Modal } from '@/components/Modal'
import { copy } from '@/features/imports/copy'
import type { CommitPreview } from '@/features/imports/types'

export interface DeliveryConfirmDialogProps {
  preview: CommitPreview | null
  /** Lines the server flagged but did not block on — a price far above the last one, say. */
  warningCount: number
  committing: boolean
  error: string | null
  onConfirm: () => void
  onReview: () => void
  onClose: () => void
}

/**
 * The last look before stock is recorded — the same server-written lines and button label the
 * spreadsheet flow's confirm step shows, in a dialog so the typed quantities stay behind it.
 *
 * Warnings do not block. They get a way into the full review instead, next to the button that
 * goes ahead anyway.
 */
export function DeliveryConfirmDialog({
  preview,
  warningCount,
  committing,
  error,
  onConfirm,
  onReview,
  onClose,
}: DeliveryConfirmDialogProps) {
  return (
    <Modal
      open={preview != null}
      onClose={() => {
        if (!committing) onClose()
      }}
      title={preview?.headline ?? copy.delivery.confirmTitle}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={committing}>
            {copy.delivery.notYet}
          </Button>
          <Button loading={committing} disabled={preview?.blocked} onClick={onConfirm}>
            {committing ? copy.delivery.committing : preview?.confirmLabel}
          </Button>
        </>
      }
    >
      {preview && (
        <div className="flex flex-col gap-4">
          <dl className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200">
            {preview.lines.map((line) => (
              <div key={line.key} className="flex flex-col gap-1 px-4 py-3">
                <dt className="text-xs font-semibold text-neutral-500">{line.label}</dt>
                <dd className="text-sm text-neutral-800">{line.text}</dd>
              </div>
            ))}
          </dl>

          {warningCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3">
              <p className="text-sm text-warning-800">{copy.delivery.needsLook(warningCount)}</p>
              <Button variant="secondary" onClick={onReview} disabled={committing}>
                {copy.delivery.reviewFirst}
              </Button>
            </div>
          )}

          <p className="text-sm text-neutral-500">{copy.delivery.confirmReassure}</p>

          {preview.blocked && preview.blockedReason && (
            <ErrorState variant="inline" title={copy.confirm.blockedTitle} message={preview.blockedReason} />
          )}
          {error && <ErrorState variant="inline" message={error} />}
        </div>
      )}
    </Modal>
  )
}
