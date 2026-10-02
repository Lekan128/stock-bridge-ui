import { useState } from 'react'
import { VendorFormModal } from '@/features/vendors/components/VendorFormModal'
import type { CompanyVendor } from '@/features/vendors/types'

/** The select's sentinel for "+ Add new supplier". Never a real id, never submitted. */
const NEW_SUPPLIER = '__new__'

export interface SupplierFieldProps {
  id: string
  label: string
  /** The empty-value option's text — "No supplier yet" on the product form, "Any supplier" here. */
  placeholderLabel: string
  /** A supplier id, or '' for none/any. */
  value: string
  onChange: (vendorId: string) => void
  vendors: CompanyVendor[]
  loading?: boolean
  disabled?: boolean
  /** MANAGE_VENDORS — whether "+ Add new supplier" is offered at all. Gated separately from being
   *  able to see the list (VIEW_VENDORS), same split `CategoryField` makes for `canCreate`. */
  canCreate: boolean
  /** Called with the supplier the server just created, before it is selected. */
  onCreated: (vendor: CompanyVendor) => void
  hint?: string
  error?: string
}

/**
 * A supplier picker with a way to add one without leaving the form it sits in — the `CategoryField`
 * pattern (`UX_CONSISTENCY_DESIGN_PLAN.md`, Pattern A), applied to suppliers instead of categories.
 *
 * Unlike `CategoryField`, "+ Add new supplier" opens `VendorFormModal` rather than swapping the
 * select for an inline input: a supplier is not a one-field object (name, phone, address, bank
 * details, CAC number all live on it), so the modal that already exists for `VendorListPage` is
 * reused rather than re-deriving a smaller form that would drift from it within a release.
 *
 * The modal renders over whatever screen this field sits in. Nothing here navigates — the caller's
 * form, and everything typed into it, stays mounted and untouched while the supplier is created.
 */
export function SupplierField({
  id,
  label,
  placeholderLabel,
  value,
  onChange,
  vendors,
  loading,
  disabled,
  canCreate,
  onCreated,
  hint,
  error,
}: SupplierFieldProps) {
  const [addingNew, setAddingNew] = useState(false)

  function handleSelect(next: string) {
    if (next === NEW_SUPPLIER) {
      setAddingNew(true)
      return
    }
    onChange(next)
  }

  function handleSaved(vendor: CompanyVendor) {
    onCreated(vendor)
    onChange(vendor.id)
    setAddingNew(false)
  }

  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-invalid={!!error || undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        onChange={(event) => handleSelect(event.target.value)}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
      >
        <option value="">{placeholderLabel}</option>
        {vendors.map((vendor) => (
          <option key={vendor.id} value={vendor.id}>
            {vendor.name}
            {/* The kind is spelled out in the option text because a <select> cannot carry a badge,
                and "which of these is an actual ProcurePaddy seller" is the same question the
                directory list answers with one. */}
            {vendor.kind === 'VERIFIED' ? ' (ProcurePaddy seller)' : ''}
          </option>
        ))}
        {canCreate && <option value={NEW_SUPPLIER}>+ Add new supplier</option>}
      </select>
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-neutral-500">
          {loading ? 'Loading your suppliers…' : hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-danger-600">
          {error}
        </p>
      )}

      {addingNew && <VendorFormModal onClose={() => setAddingNew(false)} onSaved={handleSaved} />}
    </div>
  )
}
