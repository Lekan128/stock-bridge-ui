import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import type { VendorApplication } from '@/features/admin/types'
import { slugify } from '@/utils/slugify'

export interface ApproveVendorDialogProps {
  application: VendorApplication | null
  submitting: boolean
  onCancel: () => void
  onConfirm: (values: {
    username: string
    password: string
    confirmPassword: string
    clientIdentifier?: string
    commissionRate?: number
    reviewNote?: string
  }) => void
}

/**
 * Approving an application, which creates the vendor's account.
 *
 * <h2>Why this asks for so little</h2>
 * The business name, email, phone and address are NOT on this form, and that is deliberate rather
 * than an omission: the server takes all of them off the application row. Retyping them would
 * invite typos into fields we already have verbatim, and would let the created account disagree
 * with the application that `approvedClientId` claims produced it. What is left is the three
 * things an application genuinely cannot supply — credentials, a commission rate, and the
 * reviewer's note.
 *
 * <h2>The password is typed here and travels no further</h2>
 * It is hashed on arrival, never returned by any endpoint, and deliberately never emailed — the
 * approval email names the account and says the password comes by another route. That is
 * inconvenient on purpose: mailing it would put a working credential in plain text in two
 * mailboxes and in SES's logs. The reminder under the field is there so the reviewer knows they
 * have to pass it on themselves, rather than discovering it when the vendor cannot log in.
 *
 * <h2>The commission rate is entered as a percentage and sent as a fraction</h2>
 * The column is a fraction in 0..1 with a CHECK enforcing the range, but nobody negotiates "nought
 * point one five" — they agree fifteen percent. Typing 15 and storing 0.15 is the conversion that
 * keeps both the humans and the constraint happy; sending 15 would be a 400 naming a field the
 * reviewer thought they had filled in correctly.
 */
export function ApproveVendorDialog({
  application,
  submitting,
  onCancel,
  onConfirm,
}: ApproveVendorDialogProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [clientIdentifier, setClientIdentifier] = useState('')
  const [commissionPercent, setCommissionPercent] = useState('')
  const [reviewNote, setReviewNote] = useState('')

  // Reset whenever the target changes, so credentials typed for one applicant can never be
  // submitted against the next one the reviewer opens. The identifier is seeded from the business
  // name the same way signup seeds it from a company name.
  useEffect(() => {
    setUsername(application?.email ?? '')
    setPassword('')
    setConfirmPassword('')
    setClientIdentifier(application ? slugify(application.businessName) : '')
    setCommissionPercent('')
    setReviewNote('')
  }, [application?.id, application?.email, application?.businessName, application])

  const passwordsMatch = password === confirmPassword
  const percentValue = commissionPercent.trim() === '' ? null : Number(commissionPercent)
  const commissionValid =
    percentValue === null || (Number.isFinite(percentValue) && percentValue >= 0 && percentValue <= 100)

  const canSubmit =
    username.trim().length > 0 &&
    password.length >= 8 &&
    passwordsMatch &&
    commissionValid &&
    !submitting

  return (
    <Modal
      open={application !== null}
      onClose={onCancel}
      size="lg"
      title={application ? `Approve ${application.businessName}` : 'Approve application'}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            loading={submitting}
            onClick={() =>
              onConfirm({
                username: username.trim(),
                password,
                confirmPassword,
                clientIdentifier: clientIdentifier.trim() || undefined,
                // Percentage in, fraction out — see the class comment.
                commissionRate: percentValue === null ? undefined : percentValue / 100,
                reviewNote: reviewNote.trim() || undefined,
              })
            }
          >
            Approve and create account
          </Button>
        </>
      }
    >
      <p className="text-sm text-neutral-600">
        This creates a vendor account for{' '}
        <span className="font-medium text-neutral-900">{application?.businessName}</span> and emails
        them their username and a link to confirm their address. Their business details come from
        the application — you do not need to retype them.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <TextField
          label="Username"
          name="vendor-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          hint="What they will type at login. Their email address is the usual choice."
        />
        <TextField
          label="Company ID"
          name="vendor-client-identifier"
          value={clientIdentifier}
          onChange={(event) => setClientIdentifier(event.target.value)}
          hint="The short identifier they type alongside their username. Lowercase letters, numbers and hyphens only."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Password"
            name="vendor-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint="At least 8 characters."
            error={password.length > 0 && password.length < 8 ? 'Must be at least 8 characters' : undefined}
          />
          <TextField
            label="Confirm password"
            name="vendor-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            error={confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match' : undefined}
          />
        </div>

        {/* Not a nicety. Nothing in the product will ever tell the vendor this password, so if the
            reviewer does not pass it on, nobody can. */}
        <p className="rounded-md bg-warning-50 px-3 py-2 text-xs text-warning-800">
          We will not email this password — no email in Procure Paddy ever contains one. Give it to
          the vendor yourself, and tell them to change it from their profile after signing in.
        </p>

        <TextField
          label="Commission rate (%)"
          name="vendor-commission"
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={commissionPercent}
          onChange={(event) => setCommissionPercent(event.target.value)}
          hint="Optional. Leave blank if you have not agreed a rate yet — that is different from agreeing zero."
          error={commissionValid ? undefined : 'Enter a percentage between 0 and 100'}
        />

        <div>
          <label htmlFor="approve-review-note" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Note <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <textarea
            id="approve-review-note"
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder="e.g. Approved for packaging only — cleared with finance."
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          {/* Kept on the record for "why did we take this one on", and quoted to the applicant,
              so it should read as something they may see. */}
          <p className="mt-1 text-xs text-neutral-400">
            Stored on the application and included in the approval email.
          </p>
        </div>
      </div>
    </Modal>
  )
}
