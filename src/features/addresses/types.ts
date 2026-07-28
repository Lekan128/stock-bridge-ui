/**
 * A company's delivery location.
 *
 * No country field anywhere in this feature: ProcurePal delivers within Nigeria only, and `state`
 * is validated server-side against the 36 states + FCT — the `<select>` is a convenience, not the
 * guarantee.
 *
 * ⚠️ Null fields are omitted from the JSON entirely (`default-property-inclusion: non_null`), so
 * every nullable column is typed optional rather than `| null`.
 */
export interface DeliveryAddress {
  id: string
  label: string
  contactName: string
  contactPhone: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  landmark?: string
  deliveryNotes?: string
  branchId?: string
  branchName?: string
  isDefault: boolean
  /** DELETE is a deactivation, so an inactive row simply stops appearing in the list. */
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface DeliveryAddressPayload {
  label: string
  contactName: string
  contactPhone: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  landmark?: string
  deliveryNotes?: string
  branchId?: string
  /** Part of the same payload so "add my first warehouse and make it default" is one round trip. */
  makeDefault?: boolean
}
