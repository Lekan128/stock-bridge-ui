/**
 * Wire types for expected deliveries — `BULK_IMPORT_CX_PLAN.md` task 3.1.
 *
 * An expected delivery is what somebody ordered off the platform: a phone call to a supplier,
 * written down so "what have we got coming?" has an answer and so receiving it later is one tap
 * rather than typing the whole delivery again.
 *
 * ## `T | null` here means "absent", not `null`
 *
 * The API sets `spring.jackson.default-property-inclusion: non_null`, so a null field is **left
 * out of the JSON entirely**. Every `| null` below therefore arrives as `undefined` at runtime.
 * Compare with `== null`, `??` or `!x` — never `=== null`. The same warning at the top of
 * `features/imports/types.ts` is there because four screens once shipped with `=== null` and
 * inverted the moment they met the real server.
 */

/**
 * Three states and no more (plan §3.1). A delivery that came in two halves is **not** a fourth
 * state: it stays OPEN, and `receivedQuantity` on each line says how much of it has landed.
 */
export type ExpectedDeliveryStatus = 'OPEN' | 'RECEIVED' | 'CANCELLED'

/** One thing that was ordered, in the unit it was ordered in. */
export interface ExpectedDeliveryLine {
  id: string
  productId: string
  productName: string
  sku: string
  /**
   * Opaque — a `UnitOptions` key such as `BAG:50`. Sent straight back when receiving, never
   * decoded here.
   */
  unit: string
  /** The words for that unit: "Bag · 50 kg", "Loose · kg", "Piece". Render this. */
  comesIn: string
  quantity: number
  receivedQuantity: number
  /** What is still owed, already clamped at zero by the server. */
  outstanding: number
  /** Price of ONE `unit` — per bag on a bag line. Absent when nobody said. */
  price?: number | null
}

export interface ExpectedDelivery {
  id: string
  status: ExpectedDeliveryStatus
  /**
   * "Tony Stores, due 22 Sep" — composed server-side, like every other headline in this feature.
   * Render it as sent; do not rebuild it from `vendorName` and `expectedDate`, or the list and
   * the page start disagreeing about how the same record reads.
   */
  title: string
  vendorId?: string | null
  vendorName?: string | null
  /** ISO `YYYY-MM-DD`. Absent when the supplier never said a date — plenty never do. */
  expectedDate?: string | null
  /** Their invoice, waybill or order number, if there is one. */
  reference?: string | null
  note?: string | null
  lines: ExpectedDeliveryLine[]
  /** How many lines still owe something — what "partly arrived" means, as a number. */
  outstandingLines: number
  /** Only when at least one line carried a price. */
  total?: number | null
  /** OPEN and still owed something, so "Receive this" is worth offering. */
  receivable: boolean
  createdAt: string
}

export interface ExpectedDeliveryLineInput {
  productId: string
  unit: string
  /** Above zero; decimals allowed (2.5 bags). */
  quantity: number
  /** Price of ONE `unit`. Left out when nobody quoted one. */
  price?: number
}

/** POST /api/expected-deliveries. Blank fields are left out. */
export interface ExpectedDeliveryInput {
  vendorId?: string
  /** ISO `YYYY-MM-DD`. A date in the past is legal — overdue is a real state, not a mistake. */
  expectedDate?: string
  reference?: string
  note?: string
  lines: ExpectedDeliveryLineInput[]
}

export interface ExpectedDeliveryListParams {
  /** Left out to list every status. The screen asks for OPEN. */
  status?: ExpectedDeliveryStatus
  page?: number
  size?: number
}

/** Spring Data's `Page<T>` on the wire, same shape every other feature mirrors. */
export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
}
