import { Clock } from 'lucide-react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'

export interface ReviewImpactDialogProps {
  open: boolean
  /** Exactly the fields that changed, in form order — never the whole rule, which the form already states. */
  changedFields: string[]
  saving: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * The last thing between a vendor and an edit that takes their listing off the storefront.
 *
 * <h2>Why a confirmation, when the form already explains the rule</h2>
 * Because the explanation is read once and the edit happens later. The failure this prevents
 * is specific and was reported: a vendor changes a product name at 4pm, sees nothing unusual,
 * and discovers the next morning that buyers cannot find it. Every part of that sequence is
 * working as designed and none of it is visible at the moment it matters. So the consequence
 * is restated at the point of no return, and — this is the part that makes it useful rather
 * than nagging — it names the ACTUAL FIELDS THAT CHANGED rather than repeating the rule. A
 * vendor who changed the description on purpose gets a one-line confirmation; a vendor who
 * did not realise they had touched the SKU sees "SKU" and stops.
 *
 * <p>It appears only when an identity field really changed, so a price edit saves in one
 * click. A dialog that fired on every save would be trained away within a week and would then
 * be worse than nothing.
 *
 * <p>The confirm button is `primary`, not `danger`: this is a normal, supported thing to do,
 * not a destructive act. Red here would teach vendors that editing their own listings is
 * dangerous, which is the opposite of what stale-catalogue prevention needs.
 */
export function ReviewImpactDialog({ open, changedFields, saving, onConfirm, onCancel }: ReviewImpactDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="This will go back for review"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Keep editing
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={saving}>
            Save and send for review
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-neutral-600">
        <p>
          You have changed what this product <span className="font-medium text-neutral-900">is</span>, so we need to
          look at it again before buyers can see it:
        </p>
        <ul className="flex flex-col gap-1 rounded-md border border-warning-200 bg-warning-50 px-3 py-2.5">
          {changedFields.map((field) => (
            <li key={field} className="flex items-center gap-2 text-sm text-warning-900">
              <Clock className="h-3.5 w-3.5 shrink-0 text-warning-600" aria-hidden="true" />
              {field}
            </li>
          ))}
        </ul>
        <p>
          It comes off the storefront until we approve it — usually the same working day. Your stock and any orders
          already placed are not affected, and you do not need to resend anything.
        </p>
        <p className="text-neutral-500">
          Price and stock changes never do this. If you only meant to change one of those, go back and leave the fields
          above as they were.
        </p>
      </div>
    </Modal>
  )
}
