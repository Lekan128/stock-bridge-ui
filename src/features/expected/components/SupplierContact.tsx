import { useId, useState } from 'react'
import { Switch } from '@/components/Switch'
import { expectedCopy } from '@/features/expected/copy'
import { InlineEmailEditor } from '@/features/expected/components/InlineEmailEditor'
import type { CompanyVendor } from '@/features/vendors/types'

export interface SupplierContactProps {
  vendor: CompanyVendor
  /** MANAGE_VENDORS: may add or change the email. Without it the line is read-only. */
  canEdit: boolean
  /** "Email this order to …" — a choice for this order only, off until turned on. */
  emailOn: boolean
  onEmailOnChange: (next: boolean) => void
  /** The directory row after the email was saved, so the picker's own list stays current. */
  onVendorUpdated: (vendor: CompanyVendor) => void
}

/**
 * Under the supplier field: their phone, their email, and the switch that says whether this order
 * is emailed to them (PURCHASE_ORDER_PLAN.md §3.2, §4.3a).
 *
 * The worry behind the switch is a wrong or mistyped address, so the address is always printed next
 * to it and `Change` edits it right there — in place, not in a sheet, because it is one field. Saving
 * a *different* address turns the switch off: the new one has not been tried yet.
 */
export function SupplierContact({ vendor, canEdit, emailOn, onEmailOnChange, onVendorUpdated }: SupplierContactProps) {
  const labelId = useId()
  const [editing, setEditing] = useState(false)

  // A supplier who is on Procure Paddy keeps their own details; the server refuses edits to them.
  const lockedByThem = vendor.kind === 'VERIFIED' || vendor.editable === false
  const mayEdit = canEdit && !lockedByThem
  const email = vendor.email ?? ''

  function startEditing() {
    setEditing(true)
  }

  return (
    <div className="mt-3 flex flex-col gap-2 text-sm text-neutral-700">
      {vendor.contactPhone && (
        <p>
          <span className="text-neutral-500">Phone</span> <span className="tabular-nums">{vendor.contactPhone}</span>
        </p>
      )}

      {editing ? (
        <InlineEmailEditor
          vendor={vendor}
          onSaved={(updated) => {
            onVendorUpdated(updated)
            // A new address has not been tried: the switch asks again.
            onEmailOnChange(false)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      ) : email ? (
        <>
          <p className="flex flex-wrap items-center gap-x-2">
            <span>
              <span className="text-neutral-500">{expectedCopy.contact.emailLabel}</span> <span className="break-all">{email}</span>
            </span>
            {mayEdit && (
              <button
                type="button"
                onClick={startEditing}
                className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
              >
                {expectedCopy.contact.changeEmail}
              </button>
            )}
          </p>
          <div className="flex items-center justify-between gap-3 pt-1">
            <span id={labelId} className="min-w-0 flex-1 break-words text-neutral-900">
              {expectedCopy.contact.switchLabel(email)}
            </span>
            <Switch
              checked={emailOn}
              onChange={onEmailOnChange}
              label={expectedCopy.contact.switchLabel(email)}
              labelledBy={labelId}
            />
          </div>
        </>
      ) : (
        <p className="flex flex-wrap items-center gap-x-2 text-neutral-600">
          <span>{expectedCopy.contact.noEmail(vendor.name)}</span>
          {mayEdit ? (
            <button
              type="button"
              onClick={startEditing}
              className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
              {expectedCopy.contact.addEmail}
            </button>
          ) : lockedByThem ? (
            <span className="text-xs text-neutral-500">{expectedCopy.contact.emailLocked(vendor.name)}</span>
          ) : null}
        </p>
      )}
    </div>
  )
}
