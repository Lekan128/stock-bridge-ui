/**
 * The buying company's own vendor directory — who *we* buy from.
 *
 * ⚠️ Not to be confused with a platform vendor, which is a seller with an account and a catalog on
 * the marketplace. The API path says which: `/api/company-vendors`. A directory entry may *point*
 * at such a seller (a VERIFIED row) but it grants nobody the ability to sell anything — it is one
 * buyer's private bookkeeping about a supplier.
 *
 * ⚠️ Null fields are omitted from the JSON entirely (`default-property-inclusion: non_null`), so
 * every nullable column is typed optional rather than `| null` — same as the addresses feature.
 */

/**
 * VERIFIED — created automatically when the company bought from a ProcurePaddy seller. The company
 * may remove it from their directory but may **not** edit what it says: it asserts a fact about
 * the platform, not a note the company wrote. The server answers 409 to an edit.
 *
 * EXTERNAL — a supplier the company deals with entirely off-platform (the local miller, the diesel
 * supplier). Typed in and fully owned by the company. Has no seller account anywhere.
 */
export type VendorKind = 'VERIFIED' | 'EXTERNAL'

export interface CompanyVendor {
  id: string
  kind: VendorKind
  /** The seller's client id, for VERIFIED only. Read-only everywhere. */
  platformClientId?: string
  /**
   * The stored name. For a VERIFIED row this is a snapshot taken at the time of purchase, because
   * the list sorts, searches and pages on it — see `platformVendor.name` on the detail response
   * for the live one, which is what the detail screen shows.
   */
  name: string
  contactPhone?: string
  email?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  notes?: string
  /**
   * Whether this company may edit the row's own fields. Sent by the server rather than derived
   * from `kind` on this side, so the pencil icon and the 409 the server would answer with can
   * never disagree.
   */
  editable: boolean
  /** DELETE is a deactivation server-side, so an inactive row simply stops appearing in the list. */
  active: boolean
  createdAt: string
  updatedAt: string
}

/** The live `clients` row behind a VERIFIED entry. Absent for EXTERNAL, which has no such row. */
export interface PlatformVendorSummary {
  clientId: string
  /** Live, so it is correct even when the directory row's snapshot has gone stale after a rename. */
  name: string
  phone?: string
  email?: string
  city?: string
  state?: string
  logoUrl?: string
  active: boolean
}

/**
 * Order count, lifetime spend and last purchase date.
 *
 * All zero for an EXTERNAL vendor and always will be — an off-platform supplier has no orders in
 * this system. Cancelled orders are excluded server-side: a cancelled order is a purchase that did
 * not happen.
 */
export interface VendorSpendSummary {
  orderCount: number
  totalSpend: number
  lastPurchasedAt?: string
}

/**
 * One product the company buys from this supplier, with what they last paid for it.
 *
 * ⚠️ `lastPurchaseUnitPrice` absent means "never bought this from them through the platform" — the
 * normal case for an EXTERNAL supplier, and for a product linked by hand before it was ever
 * ordered. It must render as an em dash, never as ₦0.00: "we last paid nothing" is a different and
 * false claim.
 */
export interface VendorProductPrice {
  productId: string
  name: string
  sku: string
  unitOfMeasure?: string
  imageUrl?: string
  quantityOnHand: number
  incomingQuantity: number
  lastPurchaseUnitPrice?: number
  lastPurchaseQuantity?: number
  lastPurchasedAt?: string
  lastPurchaseOrderId?: string
  lastPurchaseOrderNumber?: string
}

export interface CompanyVendorDetail {
  vendor: CompanyVendor
  platformVendor?: PlatformVendorSummary
  spend: VendorSpendSummary
  products: VendorProductPrice[]
}

/**
 * Create/update body. There is no `kind` and no `platformClientId`, matching the server's DTO
 * exactly: this endpoint creates external suppliers and nothing else, so the payload physically
 * cannot ask for a VERIFIED row or point one at a real seller.
 */
export interface CompanyVendorPayload {
  name: string
  contactPhone: string
  email?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  notes?: string
}

export interface VendorListParams {
  kind?: VendorKind
  search?: string
  page?: number
  size?: number
}
