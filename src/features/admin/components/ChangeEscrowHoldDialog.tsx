import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { describeHold } from '@/features/admin/formatters'
import type { EscrowHoldSettings } from '@/features/admin/types'

export interface ChangeEscrowHoldDialogProps {
  open: boolean
  settings: EscrowHoldSettings
  nextHoldDays: number
  submitting: boolean
  /** The server's refusal, verbatim. A 403 here means the password did not match. */
  error: string | null
  onCancel: () => void
  onConfirm: (password: string, reason: string) => void
}

/** Matches `vendor_settlement_settings_changes.reason`, so an over-long note is caught here. */
const MAX_REASON = 500

/**
 * The confirmation step: password, acknowledgement, and the consequence spelled out before
 * either is asked for.
 *
 * <h2>Why the consequence comes first and the fields come last</h2>
 * The reading order is the argument. An operator who scrolls past a form to find a warning has
 * already decided; an operator who has to read the warning to reach the form has not. So this
 * dialog opens with what changes and what does not, and only then asks for the two things that
 * prove they meant it. It is the same reason the acknowledgement is a separate checkbox rather
 * than text next to the submit button — a box you tick is a decision, a paragraph above a button
 * is decoration.
 *
 * <h2>The three sentences that have to land</h2>
 * <ul>
 *   <li><b>This is not retroactive.</b> Money a buyer has already confirmed keeps the hold it was
 *       confirmed under. This is the fact an operator is most likely to assume the opposite of,
 *       so it is stated in the dialog, not only on the page behind it.</li>
 *   <li><b>Zero means immediate.</b> A legal value, and one that reads like a mistake as a bare
 *       number, so it gets words.</li>
 *   <li><b>Longer than a payout cycle costs a whole cycle.</b> Not obvious from the number, and
 *       the most common way to make a change that is bigger than intended.</li>
 * </ul>
 *
 * <h2>Password handling</h2>
 * Held in local state, cleared whenever the dialog closes or the target value changes, and never
 * put anywhere else. `autoComplete="current-password"` so a manager offers the right credential;
 * `type="password"` so it is not on screen in a room with other people, which for a super admin
 * console is the realistic threat rather than a theoretical one.
 */
export function ChangeEscrowHoldDialog({
  open,
  settings,
  nextHoldDays,
  submitting,
  error,
  onCancel,
  onConfirm,
}: ChangeEscrowHoldDialogProps) {
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)

  // Cleared on every open and on every change of target, so a password typed for one change can
  // never be submitted against a different one, and so a dialog reopened after a failure does
  // not present a stale value as if it had been accepted.
  useEffect(() => {
    setPassword('')
    setReason('')
    setAcknowledged(false)
  }, [open, nextHoldDays])

  const trimmedReason = reason.trim()
  const canSubmit =
    acknowledged && password.length > 0 && trimmedReason.length <= MAX_REASON && !submitting

  const longerThanCycle = nextHoldDays > settings.payoutPeriodDays

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Change the escrow hold"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => onConfirm(password, trimmedReason)}
            disabled={!canSubmit}
            loading={submitting}
          >
            Change the hold
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-md border border-warning-200 bg-warning-50 px-4 py-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning-700" aria-hidden />
        <div className="text-sm text-warning-900">
          <p className="font-medium">This changes when real money leaves the business.</p>
          <p className="mt-1">
            You are changing the escrow hold from{' '}
            <span className="font-semibold">{describeHold(settings.escrowHoldDays)}</span> to{' '}
            <span className="font-semibold">{describeHold(nextHoldDays)}</span>.
          </p>
        </div>
      </div>

      <dl className="mt-4 divide-y divide-neutral-100 text-sm">
        <ConsequenceRow
          term="What it affects"
          detail="Money a buyer confirms from now on. Each sale is stamped with the hold in force when its buyer confirmed it, and that stamp is never rewritten."
        />
        <ConsequenceRow
          term="What it does not affect"
          detail="Anything already confirmed. No payment date a vendor has already been shown will move — not forwards, not backwards."
        />
        <ConsequenceRow
          term="Payout days are unchanged"
          detail={`Payouts still run every ${settings.payoutPeriodDays} days. The hold decides whether money is eligible; the cycle decides when the run happens. They are separate.`}
        />
        {nextHoldDays === 0 && (
          <ConsequenceRow
            term="Zero means immediately"
            detail="A vendor's money becomes payable the moment the buyer confirms receipt, with no window to catch a refund or a fraudulent order. This is how the platform behaved before the hold existed."
          />
        )}
        {longerThanCycle && (
          <ConsequenceRow
            term="Longer than one payout cycle"
            detail={`${nextHoldDays} days is longer than the ${settings.payoutPeriodDays}-day payout cycle, so money confirmed in one cycle can no longer be paid by the run that closes it. Every vendor will be paid a full cycle later than before.`}
          />
        )}
        <ConsequenceRow
          term="Everyone will know"
          detail="Every super admin is emailed the change — the old value, the new value, who made it and when — and it is written to an audit log that cannot be edited or deleted."
        />
      </dl>

      <div className="mt-5 flex flex-col gap-4">
        <TextField
          label="Your password"
          name="escrow-hold-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint="Re-entered so a signed-in session left open cannot change this on its own."
          error={error ?? undefined}
        />

        <TextField
          label="Reason (optional)"
          name="escrow-hold-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={MAX_REASON}
          hint="Stored on the audit record and quoted in the email to the other super admins."
        />

        <label className="flex items-start gap-2.5 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          <span>
            I understand that this changes when vendors are paid, that it applies to money
            confirmed from now on, and that every super admin will be notified.
          </span>
        </label>
      </div>
    </Modal>
  )
}

function ConsequenceRow({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="py-2.5">
      <dt className="font-medium text-neutral-900">{term}</dt>
      <dd className="mt-0.5 text-neutral-600">{detail}</dd>
    </div>
  )
}
