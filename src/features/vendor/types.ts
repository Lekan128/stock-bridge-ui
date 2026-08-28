/**
 * Wire shapes for the seller's own workspace — `/api/vendor/*`.
 *
 * The definitions live on the server (`VendorSalesPeriodMetrics` and its siblings) and are
 * summarised here only where a reader would otherwise get the number wrong.
 *
 * ⚠️ The API sets `spring.jackson.default-property-inclusion: non_null`, so a nullable field
 * is OMITTED from the JSON rather than sent as null. Everything optional below is typed
 * `?: T` and must be guarded with `== null` / a falsy check — never `=== null`.
 *
 * <h2>What is deliberately not here</h2>
 * No customer ranking, no repeat-buyer rate, nothing about any other seller. That is the
 * server's scope decision, not an omission in this file: a seller sees its own sales, and
 * buyer-identity aggregates sit on the wrong side of that line. Adding a type here would not
 * make the endpoint exist.
 */

export type Granularity = 'DAY' | 'WEEK' | 'MONTH'
export type ProductMetric = 'REVENUE' | 'QUANTITY'

export interface VendorRangeParams {
  from: string
  to: string
}

/** One window's headline figures for the caller's own sales. The summary returns two. */
export interface VendorSalesPeriodMetrics {
  /** Goods + delivery, on the caller's orders that are neither CANCELLED nor PENDING_PAYMENT. */
  grossRevenue: number
  /** The goods half of grossRevenue — what the top-products list sums to. */
  merchandiseRevenue: number
  deliveryFeeRevenue: number
  /** The part of grossRevenue already marked PAID. gross − collected is what is still owed. */
  collectedRevenue: number
  orderCount: number
  averageOrderValue: number
  unitsSold: number
  /** Still PLACED/CONFIRMED/PROCESSING/OUT_FOR_DELIVERY — owed to a buyer, not yet delivered. */
  outstandingOrderCount: number
  outstandingOrderValue: number
  /** Delivered on credit, cash not yet reconciled — money the platform is holding. */
  payOnDeliveryOrderCount: number
  payOnDeliveryExposure: number
  cancelledOrderCount: number
  cancelledOrderValue: number
}

export interface VendorSalesSummary {
  from: string
  to: string
  /** The comparison window: same length, ending exactly where this one starts. */
  previousFrom: string
  previousTo: string
  current: VendorSalesPeriodMetrics
  previous: VendorSalesPeriodMetrics
}

/** Zero-filled by the server, so a quiet day is a real zero rather than a missing point. */
export interface VendorRevenuePoint {
  /** Bucket START date, "YYYY-MM-DD". Weeks start Monday, months on the 1st. */
  period: string
  revenue: number
  orderCount: number
  unitsSold: number
}

export interface VendorTopProduct {
  productId: string
  name: string
  sku: string
  categoryName: string
  /** Line totals only — the per-order delivery fee belongs to no single product. */
  revenue: number
  quantitySold: number
  orderCount: number
}

export type OrderStatusName =
  | 'PENDING_PAYMENT'
  | 'PLACED'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RECEIVED'
  | 'CANCELLED'

export interface VendorOrderStatusCount {
  status: OrderStatusName
  /** Includes cancelled and never-paid orders — this is the one endpoint that counts them. */
  orderCount: number
  orderValue: number
}

export interface VendorStockOut {
  productId: string
  name: string
  sku: string
  /** Physically on the shelf — the raw column. */
  quantityOnHand: number
  /** Owed to orders that have not left the warehouse. */
  committedQuantity: number
  /** onHand − committed, floored at zero. This is what the storefront advertises. */
  availableToSell: number
  /** A LISTED product at zero is a buyer about to fail to order; an unlisted one is a decision. */
  listed: boolean
  lowStockThreshold?: number
}

/**
 * Where a listing stands with platform moderation.
 *
 * Two flags decide whether a product is on the public catalogue and only one of them is the
 * seller's: `listed` says "I want this sold", this says "the platform agrees". Both are
 * required, which is why a LISTED + PENDING product is invisible and why a screen showing
 * only `listed` cannot explain it.
 */
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/** A row of the seller's own catalogue — `/api/vendor/catalogue/products`. */
export interface VendorCatalogueProduct {
  id: string
  name: string
  sku: string
  slug?: string
  description?: string
  brand?: string
  unitPrice: number
  costPrice?: number
  imageUrl?: string
  /** Display only here — read-only on this list view. Set through `/api/products` now, on every tenant. */
  unitOfMeasure?: string
  /** How this product is packaged or sold, if at all — display only, same rename/addition as `Product`. */
  packagingUnit?: string
  /** Renamed from the old `unitCount`. */
  packagingSize?: number
  minOrderQuantity: number
  /** Three stock numbers, not one — see the server DTO for why collapsing them lies. */
  quantityOnHand: number
  committedQuantity: number
  availableToSell: number
  incomingQuantity: number
  lowStockThreshold?: number
  active: boolean
  /** The SELLER's flag: "I want this sold". Not sufficient on its own. */
  listed: boolean
  categoryId?: string
  categoryName?: string
  /** The PLATFORM's flag. A listing needs APPROVED here as well as `listed` to be public. */
  approvalStatus: ApprovalStatus
  /**
   * Why a reviewer refused it. Deliberately KEPT after a later approval, so this being
   * present does not mean the listing is currently rejected — key off `approvalStatus`.
   */
  rejectionReason?: string
  reviewedAt?: string
  createdAt: string
  updatedAt: string
}

/**
 * What a SELLER may set on their own listing's marketplace facets —
 * `PUT /api/vendor/catalogue/products/:id/marketplace-details`.
 *
 * <h2>Not the same shape as the operator's `UpdateMarketplaceDetailsPayload`</h2>
 * It is that payload minus `slug`, and the missing field is deliberate rather than an
 * oversight to be tidied up later. `products.slug` is unique per TENANT while the storefront
 * resolves `/product/:idOrSlug` across every seller, so two sellers may hold the same slug and
 * the lookup returns whichever comes first. Letting a vendor type a slug turns that from a
 * curiosity into a way to aim at somebody else's URL. The server's request record has no such
 * component either, so adding one here would send a field that is silently dropped — which is
 * exactly the outcome both sides are avoiding. A vendor's slug is still derived from their
 * product name when they first list it.
 *
 * <p>⚠️ `brand` is an IDENTITY field: changing it sends the listing back for review.
 * `categoryId` and `minOrderQuantity` do not. See `ReviewImpactNotice`.
 *
 * <p>PATCH-like despite the PUT: an omitted field means "leave as is". `categoryId: undefined`
 * therefore cannot express "uncategorise", which is what `clearCategory` is for.
 *
 * <p>`unitOfMeasure` used to live here too. It moved to `/api/products` (create/update) so it
 * can be set in the SAME request as the rest of a product, for every tenant rather than just a
 * seller — this route's request DTO no longer carries it, and sending it here is simply not a
 * field the type has anymore.
 */
export interface VendorMarketplaceDetailsPayload {
  categoryId?: string
  clearCategory?: boolean
  minOrderQuantity?: number
  brand?: string
}

/** Spring Data's page shape, trimmed to what the catalogue table reads. */
export interface VendorCataloguePage {
  content: VendorCatalogueProduct[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

// ---------------------------------------------------------------------------------
// The account statement — `/api/vendor/statement` (M7)
// ---------------------------------------------------------------------------------

/**
 * The five ledger kinds. Signed FROM THE VENDOR'S POINT OF VIEW throughout: a positive
 * amount means ProcurePaddy owes them more.
 *
 * That convention is why `amount` can be added up as-is and why the running balance
 * works — nothing on this screen flips a sign, and nothing should. Rendering an unsigned
 * magnitude with a separate direction column was rejected on the server for the same
 * reason: a reader adding an unsigned column gets the wrong answer.
 */
export type LedgerEntryType =
  | 'SALE_PROCEEDS'
  | 'COMMISSION'
  | 'SALE_REVERSAL'
  | 'COMMISSION_REVERSAL'
  | 'PAYOUT'

export type PayoutBatchStatus = 'PENDING' | 'PAID' | 'FAILED'

/** One row of the statement. Optional fields are OMITTED by the API, never sent as null. */
export interface VendorStatementLine {
  id: string
  occurredAt: string
  type: LedgerEntryType
  orderId?: string
  /** Absent on a payout, which settles a fortnight of orders rather than one. */
  orderNumber?: string
  orderItemId?: string
  productName?: string
  quantity?: number
  /** Commission rows only: what the rate was applied to. */
  basisAmount?: number
  /** Commission rows only, as a fraction — `0.075` is 7.5%. */
  commissionRate?: number
  amount: number
  /** The balance AFTER this line. Lets a vendor find the row a disagreement starts at. */
  runningBalance: number
  memo?: string
  reversesEntryId?: string
}

/**
 * The four movement columns. `opening + netMovement === closing`, exactly — the API
 * guarantees it and this screen shows the working rather than asking to be believed.
 */
export interface VendorStatementMovements {
  salesProceeds: number
  /** Negative. Its magnitude is the "fees accumulated" figure. */
  commission: number
  /** Both reversal kinds netted. Usually negative; a commission-only correction is positive. */
  reversals: number
  /** Negative. Money that actually left ProcurePaddy's bank. */
  payouts: number
  netMovement: number
}

/**
 * Where the money is right now — the half of the statement a vendor cares most about.
 *
 * Three states, and only two of them are in the ledger: `pendingNet` is money the buyer
 * has paid that the vendor has not yet earned (no ledger row exists for it), `heldBalance`
 * is earned and unpaid, and settled money shows up as the `payouts` movement rather than
 * as a position.
 */
/**
 * One slice of the maturing money: how much ripens, exactly when, and which payout run
 * will therefore carry it.
 *
 * Both dates, because neither implies the other. `maturesAt` is the hold expiring — the
 * moment the money becomes eligible. `payableOnRunAfter` is the first fortnightly cut-off at
 * or after that, which is when a run would actually claim it. They are days apart, and
 * showing only one of them produces exactly the wrong expectation.
 */
export interface MaturingTranche {
  maturesAt: string
  /** Net: the sale and its commission together, so it is what the vendor actually receives. */
  amount: number
  payableOnRunAfter: string
}

export interface VendorEscrowPosition {
  pendingProceeds: number
  /** A projection computed with the same rounding rule that will later be charged. */
  pendingProjectedCommission: number
  pendingNet: number
  pendingOrderCount: number
  /** What ProcurePaddy owes right now. Same number as `closingBalance`. Can be negative after a refund. */
  heldBalance: number
  /**
   * Confirmed by the buyer — so it IS owed and IS inside `heldBalance` — but still inside its
   * hold, so no payout run may claim it yet. The bucket the escrow change introduced.
   */
  maturing: number
  /**
   * The part that has matured and that no payout batch has claimed — what the next run picks up.
   *
   * ⚠️ Can be NEGATIVE while nothing is wrong. A refund inside the hold window posts a reversal
   * that matures immediately against a sale that has not, so for the rest of that hold the
   * vendor carries a negative payable and an equal positive `maturing`, netting to the zero they
   * are actually owed. Do not clamp it — explain it.
   */
  payableNow: number
  /** Claimed by a PENDING batch: scheduled, not yet transferred. */
  inFlight: number
  /**
   * The hold currently in force, in days. Describes what NEW confirmations will get; money
   * already accrued keeps the hold it was accrued under, so this number will occasionally not
   * explain an existing tranche's date. That is correct rather than a bug.
   */
  escrowHoldDays: number
  /** When the soonest tranche ripens. Absent when nothing is maturing. */
  nextMaturityAt?: string
  maturingTranches: MaturingTranche[]
  nextPayoutCutoff: string
}

export interface PayoutBatchSummary {
  id: string
  batchNumber: string
  sellerClientId: string
  sellerName: string
  periodStart: string
  periodEnd: string
  status: PayoutBatchStatus
  currency: string
  proceedsTotal: number
  /** Negative, as the ledger stores it, so the four money fields add up without sign flipping. */
  commissionTotal: number
  reversalTotal: number
  netAmount: number
  lineCount: number
  runAt: string
  runBy?: string
  settledAt?: string
  settledBy?: string
  paymentReference?: string
  failureReason?: string
}

export interface VendorStatement {
  sellerClientId: string
  sellerName: string
  /**
   * False for ProcurePal, which sells but has no ledger — the platform cannot owe itself
   * commission. Every figure is zero in that case and the screen must say WHY rather than
   * render an empty table.
   */
  ledgerBearing: boolean
  currency: string
  from: string
  to: string
  generatedAt: string
  openingBalance: number
  movements: VendorStatementMovements
  closingBalance: number
  escrow: VendorEscrowPosition
  /** Server-authored note on what proceeds include. Rendered verbatim; never re-derive it here. */
  salesProceedsBasis: string
  lines: VendorStatementLine[]
  payouts: PayoutBatchSummary[]
}
