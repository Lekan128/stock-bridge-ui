import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Skeleton } from '@/components/Skeleton'
import { TextField } from '@/components/TextField'
import { superAdminApiClient } from '@/features/admin/api/superAdminApi'
import type { SuperAdminVendorDetail, UpdateVendorPayload } from '@/features/admin/types'
import { isAppError } from '@/types/api'

export interface EditVendorModalProps {
  /** The vendor to edit. Null closes the modal. */
  vendorId: string | null
  submitting: boolean
  onCancel: () => void
  onConfirm: (payload: UpdateVendorPayload) => void
}

/**
 * Editing a vendor's business metadata — the other half of `AddVendorModal`, and the only way a
 * vendor who came off the waitlist ever gets bank details or a CAC number on file, since the
 * public application form does not ask for either.
 *
 * <h2>It fetches the vendor rather than taking the list row</h2>
 * The list's `SuperAdminVendorSummary` carries a name, an email and a commission rate — not the
 * address, and not the payout fields. Pre-filling this form from it would render blanks over
 * values that exist, and because the server replaces rather than patches (see below) saving would
 * then erase them. So the form loads the detail first and stays a skeleton until it has it.
 *
 * <h2>REPLACE semantics, which is why every field is always rendered</h2>
 * The server writes each field as sent, so anything this form omits is stored as NULL. Every field
 * on the payload therefore has a control here, pre-filled with what is currently on file. Adding a
 * column to `UpdateVendorPayload` without adding a control here would silently start clearing it
 * on every save.
 *
 * <h2>What is deliberately absent</h2>
 * No username, no password, no Company ID. Changing a credential on a customer's only login, or
 * renaming the ID every one of their users types to sign in, are not metadata edits — the server's
 * `UpdateVendorRequest` has no component for any of them either. Suspension is likewise not here:
 * a vendor is a client, and Tenants → detail already suspends any client, with the email that goes
 * with it.
 */
export function EditVendorModal({ vendorId, submitting, onCancel, onConfirm }: EditVendorModalProps) {
  const [vendor, setVendor] = useState<SuperAdminVendorDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [commissionPercent, setCommissionPercent] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [cacNumber, setCacNumber] = useState('')

  useEffect(() => {
    if (!vendorId) {
      setVendor(null)
      setLoadError(null)
      return
    }
    let cancelled = false
    setVendor(null)
    setLoadError(null)

    superAdminApiClient
      .getVendor(vendorId)
      .then((detail) => {
        if (cancelled) return
        setVendor(detail)
        setName(detail.name)
        setEmail(detail.email ?? '')
        setContactPhone(detail.phone ?? '')
        setAddressLine1(detail.addressLine1 ?? '')
        setAddressLine2(detail.addressLine2 ?? '')
        setCity(detail.city ?? '')
        setState(detail.state ?? '')
        // Fraction on the wire, percent in the field — nobody negotiates "nought point one five".
        // Null stays blank rather than becoming 0: "no rate agreed" and "agreed zero" are
        // different arrangements and the column distinguishes them.
        setCommissionPercent(detail.commissionRate === null ? '' : String(detail.commissionRate * 100))
        setBankName(detail.bankName ?? '')
        setBankAccountNumber(detail.bankAccountNumber ?? '')
        setBankAccountName(detail.bankAccountName ?? '')
        setCacNumber(detail.cacNumber ?? '')
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(isAppError(err) ? err.message : 'We could not load this vendor.')
      })

    return () => {
      cancelled = true
    }
  }, [vendorId])

  const percentValue = commissionPercent.trim() === '' ? null : Number(commissionPercent)
  const commissionValid =
    percentValue === null || (Number.isFinite(percentValue) && percentValue >= 0 && percentValue <= 100)

  const canSubmit =
    !!vendor && name.trim().length > 0 && contactPhone.trim().length > 0 && commissionValid && !submitting

  return (
    <Modal
      open={!!vendorId}
      onClose={onCancel}
      size="lg"
      title={vendor ? `Edit ${vendor.name}` : 'Edit vendor'}
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
                // Blank is how a form says "empty"; the API stores NULL. Clearable on purpose —
                // "we no longer hold their bank details" has to be expressible.
                email: email.trim() || undefined,
                contactPhone: contactPhone.trim(),
                addressLine1: addressLine1.trim() || undefined,
                addressLine2: addressLine2.trim() || undefined,
                city: city.trim() || undefined,
                state: state.trim() || undefined,
                // Sent back unchanged. The logo is not editable here, but the payload replaces
                // rather than patches, so omitting it would clear it.
                logoUrl: vendor?.logoUrl ?? undefined,
                commissionRate: percentValue === null ? undefined : percentValue / 100,
                bankName: bankName.trim() || undefined,
                bankAccountNumber: bankAccountNumber.trim() || undefined,
                bankAccountName: bankAccountName.trim() || undefined,
                cacNumber: cacNumber.trim() || undefined,
              })
            }
          >
            Save changes
          </Button>
        </>
      }
    >
      {loadError && (
        <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {loadError}
        </p>
      )}

      {!vendor && !loadError && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-md" />
          ))}
        </div>
      )}

      {vendor && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">
            Company ID <span className="font-mono">{vendor.slug}</span> and their login are not
            editable here.
          </p>

          <TextField
            label="Business name"
            name="edit-vendor-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Contact number"
              name="edit-vendor-phone"
              type="tel"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
            />
            <TextField
              label="Email (optional)"
              name="edit-vendor-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          {email.trim() === '' && (
            <p className="rounded-md bg-warning-50 px-3 py-2 text-xs text-warning-800">
              Without an email address this vendor cannot be sent order notifications — and a seller
              who does not hear about an order does not ship it.
            </p>
          )}

          <TextField
            label="Address (optional)"
            name="edit-vendor-address"
            value={addressLine1}
            onChange={(event) => setAddressLine1(event.target.value)}
          />
          <TextField
            label="Address line 2 (optional)"
            name="edit-vendor-address-2"
            value={addressLine2}
            onChange={(event) => setAddressLine2(event.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="City (optional)"
              name="edit-vendor-city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
            <TextField
              label="State (optional)"
              name="edit-vendor-state"
              value={state}
              onChange={(event) => setState(event.target.value)}
            />
          </div>

          <TextField
            label="Commission rate (%)"
            name="edit-vendor-commission"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={commissionPercent}
            onChange={(event) => setCommissionPercent(event.target.value)}
            hint="Blank means no rate agreed, which is different from agreeing zero."
            error={commissionValid ? undefined : 'Enter a percentage between 0 and 100'}
          />

          <div className="border-t border-neutral-100 pt-4">
            <h3 className="text-sm font-semibold text-neutral-900">Payout &amp; registration</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              All optional. Where Procure Paddy pays this vendor out, and their CAC number. Never
              shown to buyers.
            </p>
            <div className="mt-3 flex flex-col gap-4">
              <TextField
                label="Bank name (optional)"
                name="edit-vendor-bank-name"
                value={bankName}
                onChange={(event) => setBankName(event.target.value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Account number (optional)"
                  name="edit-vendor-bank-account-number"
                  // inputMode, not type="number": a NUBAN is a 10-digit identifier, not a quantity.
                  inputMode="numeric"
                  value={bankAccountNumber}
                  onChange={(event) => setBankAccountNumber(event.target.value)}
                />
                <TextField
                  label="Account name (optional)"
                  name="edit-vendor-bank-account-name"
                  value={bankAccountName}
                  onChange={(event) => setBankAccountName(event.target.value)}
                  hint="If it differs from the business name."
                />
              </div>
              <TextField
                label="CAC number (optional)"
                name="edit-vendor-cac-number"
                value={cacNumber}
                onChange={(event) => setCacNumber(event.target.value)}
                hint="Corporate Affairs Commission registration number, e.g. RC 123456."
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
