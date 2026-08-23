import type { TenantUserSummary } from '@/features/users/types'

/**
 * `clients.payment_terms`. Declared here as well as in features/company because the two APIs
 * are separate surfaces that happen to agree today — the same call the codebase already makes
 * for `PageResponse`, which exists independently in features/products and features/users.
 */
export type PaymentTerms = 'PREPAID' | 'PAY_ON_DELIVERY_ALLOWED'

export interface SuperAdminClientSummary {
  id: string
  name: string
  /**
   * The login identifier. The tenant-facing CompanyResponse calls this same column
   * `clientIdentifier`; this surface has called it `slug` since it shipped and keeps doing so.
   * The divergence is deliberate — do not map one name onto the other.
   */
  slug: string
  active: boolean
  adminEmail: string
  userCount: number
  productCount: number
  createdAt: string
}

/**
 * GET /api/superadmin/clients/{id}, and the response to both writes on that row
 * (PUT /{id} and PUT /{id}/status).
 *
 * `phone`, `platformOwner` and `paymentTerms` were appended to the backend record after it
 * first shipped. `platformOwner` and `active` are reported but never accepted — `active` has
 * its own dedicated status endpoint, and there is no API at all for `platformOwner`.
 */
export interface SuperAdminClientDetail extends SuperAdminClientSummary {
  updatedAt: string
  activeUserCount: number
  activeProductCount: number
  lowStockProductCount: number
  phone?: string | null
  platformOwner: boolean
  paymentTerms: PaymentTerms
}

/**
 * PUT /api/superadmin/clients/{id}. Replace semantics for everything except `slug`.
 *
 * `slug` is optional and null/absent means "do not rename" — there is no such thing as
 * clearing it. Renaming it changes what every user of that company types at login, so the UI
 * only ever sends it when an ops user has deliberately opted into a rename (EditClientModal).
 *
 * `active` is NOT here: suspension keeps its own PUT /{id}/status endpoint so a routine profile
 * save can never un-suspend a tenant somebody suspended for a reason.
 */
export interface UpdateClientPayload {
  name: string
  adminEmail: string
  phone: string | null
  paymentTerms: PaymentTerms
  slug?: string
}

/**
 * GET /api/superadmin/clients/{clientId}/users and the platform-owner user endpoints all serve
 * the same `UserSummaryResponse` record that /api/users does, so the tenant type is reused
 * rather than copied — a second declaration could only ever drift out of agreement with it.
 */
export type SuperAdminUserSummary = TenantUserSummary

export interface TenantBreakdownEntry {
  clientId: string
  clientName: string
  active: boolean
  activeUserCount: number
  activeProductCount: number
  stockInValue: number
  stockOutValue: number
}

export interface PlatformAggregateResponse {
  totalActiveClients: number
  totalActiveUsers: number
  totalActiveProducts: number
  totalStockInValue: number
  totalStockOutValue: number
  tenantBreakdown: TenantBreakdownEntry[]
}

/* -------------------------------------------------------------- Cross-seller revenue (M6)
 * Wire shapes for `/api/superadmin/analytics/revenue/**`.
 *
 * This is the ONLY place total marketplace revenue exists. M6 narrowed ProcurePal's own
 * analytics (`/api/marketplace/admin/analytics/**`, typed in features/marketplace/analytics)
 * to its own sales, because the operator was reading a figure that included third-party
 * vendors' money. The cross-seller total moved here, to the super admin principal — a
 * separate login with a separate token audience, which is what keeps every tenant, vendor
 * and buying company out of it.
 *
 * ⚠️ The API sets `spring.jackson.default-property-inclusion: non_null`, so a nullable field
 * is OMITTED from the JSON rather than sent as null. `revenueGrowthRate` is the one such
 * field below and must be guarded with `== null`, never `=== null`.
 */

/** One window's cross-seller headline figures. The summary endpoint returns two of these. */
export interface PlatformRevenuePeriodMetrics {
  /** Goods + delivery across EVERY seller, on orders neither CANCELLED nor PENDING_PAYMENT. */
  grossRevenue: number
  /** The goods half of grossRevenue. */
  merchandiseRevenue: number
  deliveryFeeRevenue: number
  /** The part of grossRevenue already marked PAID. gross − collected is what is still owed. */
  collectedRevenue: number
  orderCount: number
  averageOrderValue: number
  unitsSold: number
  /** Sellers that actually took an order in the window — not the count of vendor accounts. */
  sellingSellerCount: number
  /**
   * Distinct buying companies across the whole marketplace. Deliberately NOT the sum of the
   * per-seller counts: a company that bought from two sellers is one company here and one on
   * each of their rows.
   */
  buyingCompanyCount: number
  cancelledOrderCount: number
  cancelledOrderValue: number
}

/** GET /api/superadmin/analytics/revenue/summary. */
export interface PlatformRevenueSummary {
  from: string
  to: string
  previousFrom: string
  previousTo: string
  current: PlatformRevenuePeriodMetrics
  previous: PlatformRevenuePeriodMetrics
}

/** One bucket of the marketplace-wide growth curve. Zero-filled server-side. */
export interface PlatformRevenuePoint {
  /** Bucket START date as "YYYY-MM-DD" — week buckets start Monday, month buckets on the 1st. */
  period: string
  revenue: number
  orderCount: number
  unitsSold: number
  sellingSellerCount: number
}

/**
 * One seller's row in the breakdown.
 *
 * Sellers appear if they traded in EITHER window, which is what makes a vendor that stopped
 * selling visible rather than absent — the row an operator most needs. `active` is carried so
 * "stopped selling" can be told apart from "we switched them off".
 */
export interface SellerRevenueEntry {
  sellerClientId: string
  name: string
  slug: string
  clientType: 'COMPANY' | 'VENDOR'
  /** True for exactly one row: ProcurePal's. It is what makes "ours vs theirs" readable. */
  platformOwner: boolean
  active: boolean
  revenue: number
  merchandiseRevenue: number
  orderCount: number
  averageOrderValue: number
  unitsSold: number
  buyingCompanyCount: number
  /** 0..1 share of the response's total revenue. */
  revenueShare: number
  previousRevenue: number
  /** Signed naira change against the preceding window. */
  revenueGrowth: number
  /**
   * Signed ratio, or ABSENT when the previous window was empty — a percentage change from
   * zero is undefined. Render "new" from the absence rather than printing 0% or ∞.
   */
  revenueGrowthRate?: number
}

/** GET /api/superadmin/analytics/revenue/by-seller. */
export interface SellerRevenueBreakdown {
  from: string
  to: string
  previousFrom: string
  previousTo: string
  /** The total OF THIS RESPONSE, so it honours the filters. With a seller filter it is that seller's. */
  totalRevenue: number
  previousTotalRevenue: number
  sellers: SellerRevenueEntry[]
}

export type SellerRevenueSort = 'REVENUE' | 'ORDERS' | 'UNITS' | 'AVERAGE_ORDER_VALUE' | 'GROWTH' | 'NAME'

/** Fulfilment statuses the revenue filters accept — the server's OrderStatus enum. */
export type PlatformRevenueOrderStatus =
  | 'PENDING_PAYMENT'
  | 'PLACED'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RECEIVED'
  | 'CANCELLED'

/** Payment statuses the revenue filters accept — the server's PaymentStatus enum. */
export type PlatformRevenuePaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'ON_DELIVERY' | 'REFUNDED'

/**
 * Filters shared by all three revenue endpoints. Every field is optional and omitted rather
 * than sent empty — the API adds a SQL predicate per present filter, so an empty string would
 * bind as a value rather than mean "no filter".
 */
export interface PlatformRevenueParams {
  from?: string
  to?: string
  sellerId?: string
  status?: PlatformRevenueOrderStatus
  paymentStatus?: PlatformRevenuePaymentStatus
}

export type ClientStatusFilter = 'all' | 'active' | 'suspended'


export interface ClientListParams {
  search?: string
  active?: boolean
  page?: number
  size?: number
}

/** Both super-admin user listings are plain paginated reads — no search or filter server-side. */
export interface AdminUserListParams {
  page?: number
  size?: number
}

// ---------------------------------------------------------------- Listing moderation (M4)

/**
 * Where a listing stands with the platform's moderation.
 *
 * Flat, with no transition table, because unlike an order a listing can move back and forth
 * between these states any number of times as a vendor fixes and resubmits.
 */
export type ProductApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/**
 * One listing awaiting — or having had — a moderation decision.
 *
 * Only SELLERS' products ever appear here. `products.approval_status` defaults to PENDING on every
 * row in the system, including every buying company's private inventory, so the server pins this
 * queue to the vendor-seller set; a reviewer must never be shown a restaurant's list of its own
 * cooking oil and asked to approve it. See the backend's ProductModerationSpecifications.
 *
 * Note there is no `costPrice`: a listing is judged on whether it is honest, not on the vendor's
 * margin, and a moderation screen is not a reason to pipe one business's buying prices to the
 * operator's browser.
 */
export interface ModerationProduct {
  id: string
  name: string
  sku: string
  slug: string | null
  description: string | null
  brand: string | null
  unitPrice: number
  imageUrl: string | null
  unitOfMeasure: string | null
  minOrderQuantity: number
  approvalStatus: ProductApprovalStatus
  rejectionReason: string | null
  reviewedAt: string | null
  reviewedBy: string | null
  /**
   * Whether the seller has asked for this to be public. A PENDING listing with this false is a
   * draft the vendor has not submitted; with it true, the vendor is waiting on the operator.
   */
  marketplaceListed: boolean
  active: boolean
  sellerId: string | null
  sellerName: string | null
  sellerSlug: string | null
  sellerLogoUrl: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Badge counts for the moderation tabs.
 *
 * `awaitingReview` is deliberately not `pending`: it counts only the PENDING listings a vendor has
 * actually asked to publish. Unsubmitted drafts are PENDING too, but nobody is waiting on the
 * operator for them, and a badge that counted drafts would never reach zero however diligently the
 * queue is worked — which is how a badge stops being read at all.
 */
export interface ModerationCounts {
  awaitingReview: number
  pending: number
  approved: number
  rejected: number
}

export interface ModerationQueueParams {
  status?: ProductApprovalStatus
  /** Everything regardless of status — the "All" tab. */
  all?: boolean
  sellerId?: string
  q?: string
  page?: number
  size?: number
}

// ============================================================================
// Vendor onboarding (M2). Two related surfaces: the waitlist queue, and the
// vendor accounts a decision on that queue produces.
// ============================================================================

export type VendorWaitlistStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/**
 * One row of the vendor waitlist.
 *
 * One shape rather than a summary/detail pair, matching the API: an application is fourteen
 * columns on one row with no joins, and the field a reviewer reads first (`notes`, the applicant's
 * own description of their business) is exactly the field a "summary" would drop.
 */
export interface VendorApplication {
  id: string
  businessName: string
  email: string
  contactPhone: string
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  /** What the applicant told us about themselves. Free text, deliberately unparsed. */
  notes: string | null
  status: VendorWaitlistStatus
  reviewNote: string | null
  /** The super_admins row that decided. Null while PENDING. */
  reviewedBy: string | null
  reviewedAt: string | null
  /** The clients row approval created. Non-null exactly when status is APPROVED. */
  approvedClientId: string | null
  createdAt: string
  updatedAt: string
}

/** Badge counts for the queue tabs and the nav. */
export interface VendorWaitlistCounts {
  pending: number
  approved: number
  rejected: number
}

export interface VendorWaitlistParams {
  /** Omit for the full history, newest first. Present for one queue, oldest first. */
  status?: VendorWaitlistStatus
  page?: number
  size?: number
}

/**
 * A vendor account, in a list.
 *
 * `userCount` is here for one reason: a vendor has exactly ONE user account and cannot create
 * staff, so this is the cheapest possible check that the rule is holding. Anything other than 1
 * on a live vendor is a bug somebody should see.
 */
export interface SuperAdminVendorSummary {
  id: string
  name: string
  slug: string
  active: boolean
  /** Nullable for a vendor — a super admin may add a business they have no email for. */
  email: string | null
  phone: string | null
  /** The vendor's single login. Null only in a state that should not happen. */
  username: string | null
  /** A FRACTION in 0..1, not a percentage. 0.15 is fifteen percent. Null if none agreed. */
  commissionRate: number | null
  userCount: number
  productCount: number
  /** True when this vendor came off the waitlist; false when ops recruited them offline. */
  fromWaitlist: boolean
  createdAt: string
}

export interface SuperAdminVendorDetail {
  id: string
  name: string
  slug: string
  active: boolean
  email: string | null
  phone: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  logoUrl: string | null
  commissionRate: number | null
  /** The vendor's single user. Null only in a state that should not happen. */
  userId: string | null
  username: string | null
  productCount: number
  /** Null when this vendor was created directly rather than off the waitlist. */
  applicationId: string | null
  appliedAt: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface VendorListParams {
  search?: string
  active?: boolean
  page?: number
  size?: number
}

/**
 * Approving an application.
 *
 * Deliberately thinner than CreateVendorPayload: the business name, email, phone and address all
 * come off the application row server-side. Retyping them would invite typos into fields we have
 * verbatim and would let the approved account disagree with the application that
 * `approvedClientId` says produced it.
 */
export interface ApproveVendorApplicationPayload {
  username: string
  password: string
  confirmPassword: string
  /** Optional; derived from the business name when blank. */
  clientIdentifier?: string
  commissionRate?: number
  /** Optional here, required on rejection — see RejectVendorApplicationPayload. */
  reviewNote?: string
}

/**
 * Rejecting an application. The note is required because it IS the email the applicant receives —
 * optional, it would be skipped most of the time and every rejected business would get a notice
 * that reads as a decision a machine made.
 */
export interface RejectVendorApplicationPayload {
  reviewNote: string
}

export interface CreateVendorPayload {
  name: string
  clientIdentifier?: string
  /** Optional — this is precisely what the relaxed clients CHECK exists for. */
  email?: string
  contactPhone: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  commissionRate?: number
  username: string
  password: string
  confirmPassword: string
}


// ---------------------------------------------------------------------- Settlement policy (M9)

/**
 * One line of the escrow hold's change history: from what, to what, by whom, when and why.
 *
 * `changedBy` is the super admin's id and goes absent once that account is deleted;
 * `changedByUsername` is snapshotted on the row and never does. Render the username — a
 * history line has to keep meaning something after the operator who made the change has left.
 */
export interface EscrowHoldChangeEntry {
  id: string
  previousHoldDays: number
  newHoldDays: number
  changedBy?: string
  changedByUsername: string
  reason?: string
  changedAt: string
}

/**
 * The escrow hold — how many days after a buyer confirms receipt a vendor's money becomes
 * payout-eligible.
 *
 * The bounds and the retroactivity note travel in the payload rather than being hard-coded
 * here, because both are policy the server owns and a screen that duplicated them would drift
 * the day somebody widened them.
 */
export interface EscrowHoldSettings {
  escrowHoldDays: number
  /** Zero is a LEGAL value meaning "payable the moment the buyer confirms". Offer it. */
  minHoldDays: number
  maxHoldDays: number
  /**
   * The payout cadence, 14. Not changeable — carried so the screen can warn that a hold longer
   * than a cycle pushes every vendor a full cycle later.
   */
  payoutPeriodDays: number
  /**
   * Always true, and the single most important sentence on the screen: a change applies to money
   * confirmed FROM NOW ON. Nothing already accrued moves.
   */
  appliesToFutureAccrualsOnly: boolean
  updatedAt: string
  /** Absent until somebody changes the hold for the first time. */
  lastChange?: EscrowHoldChangeEntry
  recentChanges: EscrowHoldChangeEntry[]
}

/**
 * Changing the hold. Three things have to be true and each blocks a different mistake: being a
 * super admin (the route), knowing the password (a borrowed laptop), and ticking the box (an
 * accidental submit).
 *
 * A wrong password is a 403 whose message distinguishes nothing — do not try to parse it for a
 * reason, there is not one. A missing acknowledgement is a 400.
 */
export interface UpdateEscrowHoldPayload {
  holdDays: number
  password: string
  acknowledged: boolean
  reason?: string
}
