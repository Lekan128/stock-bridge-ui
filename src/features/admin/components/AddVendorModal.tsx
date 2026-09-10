import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import type { CreateVendorPayload } from '@/features/admin/types'
import { slugify } from '@/utils/slugify'

export interface AddVendorModalProps {
  open: boolean
  submitting: boolean
  onCancel: () => void
  onConfirm: (payload: CreateVendorPayload) => void
}

/**
 * Adding a vendor ProcurePaddy recruited offline, with no application behind it.
 *
 * <h2>Why the email is optional here and required on the public form</h2>
 * This is the single reason the `clients` CHECK was narrowed to cover COMPANY only. A business
 * that came through the waitlist is known to us by the address they left — it is their identifier
 * and the only way to reply — so the public form requires it. A business an ops user met at a
 * trade fair may genuinely have no email, and both alternatives were worse: refusing to onboard
 * them at all, or writing a synthetic placeholder into the column the mailer reads, at which point
 * we send real mail to an address we invented.
 *
 * <p>The cost is real and is stated at the point of entry rather than left to be discovered: a
 * vendor with no email gets no order notifications, and VENDOR_RESEARCH.md section C item 8 is
 * blunt that missing vendor notifications cause the most visible failure of the lot — unshipped
 * orders, because a single-user vendor does not sit in a dashboard waiting.
 *
 * <h2>Nothing is emailed by this flow</h2>
 * Unlike approval, creating a vendor directly sends no mail at all. The ops user typing this is by
 * definition already talking to the business — that is how they have the phone number — and the
 * password has to reach them through that conversation regardless. An unsolicited "your account is
 * ready" to somebody who never asked is also the kind of mail that earns a complaint, and
 * complaints are scored against a sending domain every tenant shares.
 */
export function AddVendorModal({ open, submitting, onCancel, onConfirm }: AddVendorModalProps) {
  const [name, setName] = useState('')
  const [clientIdentifier, setClientIdentifier] = useState('')
  const [identifierEdited, setIdentifierEdited] = useState(false)
  const [email, setEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [commissionPercent, setCommissionPercent] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (open) return
    setName('')
    setClientIdentifier('')
    setIdentifierEdited(false)
    setEmail('')
    setContactPhone('')
    setAddressLine1('')
    setCity('')
    setState('')
    setCommissionPercent('')
    setUsername('')
    setPassword('')
    setConfirmPassword('')
  }, [open])

  const passwordsMatch = password === confirmPassword
  const percentValue = commissionPercent.trim() === '' ? null : Number(commissionPercent)
  const commissionValid =
    percentValue === null || (Number.isFinite(percentValue) && percentValue >= 0 && percentValue <= 100)

  const canSubmit =
    name.trim().length > 0 &&
    // Required even though the email is not. A vendor with neither is a row nobody can reach;
    // which channel exists is negotiable, having none is not.
    contactPhone.trim().length > 0 &&
    username.trim().length > 0 &&
    password.length >= 8 &&
    passwordsMatch &&
    commissionValid &&
    !submitting

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="lg"
      title="Add a vendor"
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
                name: name.trim(),
                clientIdentifier: clientIdentifier.trim() || undefined,
                // Blank is how a form says "empty"; the API stores NULL.
                email: email.trim() || undefined,
                contactPhone: contactPhone.trim(),
                addressLine1: addressLine1.trim() || undefined,
                city: city.trim() || undefined,
                state: state.trim() || undefined,
                // Percentage in, fraction out — the column is 0..1 with a CHECK, but nobody
                // negotiates "nought point one five".
                commissionRate: percentValue === null ? undefined : percentValue / 100,
                username: username.trim(),
                password,
                confirmPassword,
              })
            }
          >
            Create vendor
          </Button>
        </>
      }
    >
      <p className="text-sm text-neutral-600">
        For a business you recruited yourself. Nothing is emailed — give them their username and
        password directly.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <TextField
          label="Business name"
          name="new-vendor-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (!identifierEdited) setClientIdentifier(slugify(event.target.value))
          }}
        />
        <TextField
          label="Company ID"
          name="new-vendor-client-identifier"
          value={clientIdentifier}
          onChange={(event) => {
            setIdentifierEdited(true)
            setClientIdentifier(event.target.value)
          }}
          hint="What they type alongside their username at login. Lowercase letters, numbers and hyphens only."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Contact number"
            name="new-vendor-phone"
            type="tel"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
          />
          <TextField
            label="Email (optional)"
            name="new-vendor-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        {email.trim() === '' && (
          <p className="rounded-md bg-warning-50 px-3 py-2 text-xs text-warning-800">
            Without an email address this vendor cannot be sent order notifications — and a seller
            who does not hear about an order does not ship it. Add one later from their detail page
            if you get one.
          </p>
        )}

        <TextField
          label="Address (optional)"
          name="new-vendor-address"
          value={addressLine1}
          onChange={(event) => setAddressLine1(event.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="City (optional)"
            name="new-vendor-city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
          <TextField
            label="State (optional)"
            name="new-vendor-state"
            value={state}
            onChange={(event) => setState(event.target.value)}
          />
        </div>

        <TextField
          label="Commission rate (%)"
          name="new-vendor-commission"
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={commissionPercent}
          onChange={(event) => setCommissionPercent(event.target.value)}
          hint="Optional. Blank means no rate agreed, which is different from agreeing zero."
          error={commissionValid ? undefined : 'Enter a percentage between 0 and 100'}
        />

        <div className="border-t border-neutral-100 pt-4">
          <h3 className="text-sm font-semibold text-neutral-900">Their login</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            A vendor has exactly one account and cannot create staff, so this is the only login
            they will ever have.
          </p>
          <div className="mt-3 flex flex-col gap-4">
            <TextField
              label="Username"
              name="new-vendor-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Password"
                name="new-vendor-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                hint="At least 8 characters."
                error={password.length > 0 && password.length < 8 ? 'Must be at least 8 characters' : undefined}
              />
              <TextField
                label="Confirm password"
                name="new-vendor-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                error={confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match' : undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
