import { expectedCopy } from '@/features/expected/copy'
import { InlineEmailEditor } from '@/features/expected/components/InlineEmailEditor'
import type { CompanyVendor } from '@/features/vendors/types'

export interface SupplierContactProps {
  vendor: CompanyVendor
  /** MANAGE_VENDORS: may add or change the email. Without it the line is read-only. */
  canEdit: boolean
  /** The email field is open here. Lifted to the page because "Add one" is offered beside the switch too. */
  editing: boolean
  onEditingChange: (editing: boolean) => void
  /** The directory row after the email was saved, so the picker's own list stays current. */
  onVendorUpdated: (vendor: CompanyVendor) => void
}

/** Whether this supplier's details may be changed from here. A supplier on Procure Paddy manages their own. */
export function mayEditSupplier(vendor: CompanyVendor, canEdit: boolean): boolean {
  return canEdit && vendor.kind !== 'VERIFIED' && vendor.editable !== false
}

/**
 * Under the supplier field: their phone and their email, with `Change` / `Add one` right there
 * (PURCHASE_ORDER_PLAN.md §3.2). The switch that decides whether this order is emailed is NOT here —
 * it sits in "What happens next", beside the button it explains, because that is where the
 * decision is made and where somebody scrolling past a long product list will actually see it.
 *
 * The address is edited in place, not in a sheet, because it is one field.
 */
export function SupplierContact({ vendor, canEdit, editing, onEditingChange, onVendorUpdated }: SupplierContactProps) {
  const lockedByThem = vendor.kind === 'VERIFIED' || vendor.editable === false
  const mayEdit = mayEditSupplier(vendor, canEdit)
  const email = vendor.email ?? ''

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
            onEditingChange(false)
          }}
          onCancel={() => onEditingChange(false)}
        />
      ) : email ? (
        <p className="flex flex-wrap items-center gap-x-2">
          <span>
            <span className="text-neutral-500">{expectedCopy.contact.emailLabel}</span> <span className="break-all">{email}</span>
          </span>
          {mayEdit && (
            <button
              type="button"
              onClick={() => onEditingChange(true)}
              className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
              {expectedCopy.contact.changeEmail}
            </button>
          )}
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-x-2 text-neutral-600">
          <span>{expectedCopy.contact.noEmail(vendor.name)}</span>
          {mayEdit ? (
            <button
              type="button"
              onClick={() => onEditingChange(true)}
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
