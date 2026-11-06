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

/**
 * What became of the latest attempt to email a purchase order to its supplier. `SENT` is said as
 * "Emailed" — the email provider took it; we never claim it was delivered or read.
 */
export type PurchaseOrderEmailStatus = 'SENT' | 'FAILED' | 'BOUNCED' | 'COMPLAINED'

export interface PurchaseOrderEmail {
  status: PurchaseOrderEmailStatus
  /** The address it went to, or was meant for. Absent when the supplier had none. */
  toAddress?: string | null
  /** When the attempt was made. */
  sentAt: string
  /** A plain sentence for the screen, as it is — absent when nothing went wrong. */
  problem?: string | null
}

/**
 * What the buyer needs to send a purchase order themselves. Only on a single order, never in the
 * list, and only on a purchase order.
 */
export interface PurchaseOrderShare {
  token: string
  /** The page the supplier opens, when the server knows the app's address. */
  url?: string | null
  /** The message to send or paste, in the buyer's voice, link included. Absent in the list. */
  message?: string | null
  /** Opens WhatsApp to the supplier with `message` typed. Absent when there is no usable number. */
  whatsappUrl?: string | null
  /** When the buyer last opened WhatsApp for it. All we can know — never "delivered" or "read". */
  whatsappOpenedAt?: string | null
  messageCopiedAt?: string | null
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
  /** The lines' amounts plus delivery; only when a line carries a price. */
  total?: number | null
  /** What the supplier charges to bring it (V77). Absent: not said. Zero: free. */
  deliveryCharge?: number | null
  /** Absent when no approval was involved: every order by someone who can send. */
  approval?: PurchaseOrderApproval | null
  /** OPEN and still owed something, so "Receive this" is worth offering. */
  receivable: boolean
  createdAt: string
  /** Multiple branches (V52): the branch it is going to. */
  branchId?: string
  /** "PO-0007" on a purchase order. Absent on one that was only written down — that is how to tell. */
  poNumber?: string | null
  revision?: number
  email?: PurchaseOrderEmail | null
  share?: PurchaseOrderShare | null
  /** Who made it ("Dami Ade"). Absent on old records. */
  createdByName?: string | null
  /** When the supplier was last given it, and how (V76). Absent when never. */
  sentAt?: string | null
  sentVia?: SentVia | null
  /** A purchase order whose current revision the supplier hasn't been given: never sent, or changed since. */
  waitingToBeSent: boolean
  /** The deliveries received against it, oldest first. Only on a single order. */
  receipts?: PurchaseOrderReceipt[] | null
}

/** How the supplier got it: emailed, WhatsApp opened, message copied, or ordered by phone (nothing sent). */
export type SentVia = 'EMAIL' | 'WHATSAPP' | 'MESSAGE' | 'PHONE'

export interface PurchaseOrderReceipt {
  /** The delivery's own record — `/app/products/import/{importId}/result`. */
  importId: string
  receivedAt: string
  receivedByName?: string | null
  lineCount: number
  /** What went back with the driver on this delivery (V79). */
  sentBack?: PurchaseOrderSentBack[]
}

export interface PurchaseOrderSentBack {
  productId: string
  productName: string
  unit: string
  comesIn: string
  quantity: number
  reason: 'WRONG_ITEM' | 'DAMAGED' | 'EXPIRED' | 'NOT_ORDERED' | 'PRICE' | 'OTHER'
  note?: string | null
}

/** The list's filter chips. */
export type PurchaseOrderView = 'ALL' | 'OPEN' | 'TO_APPROVE' | 'TO_SEND' | 'WAITING' | 'LATE' | 'ARRIVED' | 'CALLED_OFF'

/** Where an order stands on approval (V78, plan section 11.5), with who and when. */
export interface PurchaseOrderApproval {
  status: 'WAITING' | 'CHANGE_ASKED' | 'APPROVED'
  askedBy?: string | null
  askedByName?: string | null
  askedAt?: string | null
  /** What the person asking wrote for the approver. */
  note?: string | null
  approvedByName?: string | null
  approvedAt?: string | null
  changeAskedByName?: string | null
  changeAskedAt?: string | null
  /** What the approver asked to be changed. */
  changeNote?: string | null
}

/** How many each chip holds. */
export interface PurchaseOrderCounts {
  toSend: number
  waiting: number
  late: number
  arrived: number
  all: number
  /** Waiting for an approver, or back with whoever made it for a change (V78). */
  toApprove: number
}

/**
 * One way of buying one product, as the new-order picker returns it: with what decides "how many?"
 * — what is left, low or out, already coming, and last time — all in this line's own unit.
 */
export interface PickerLine {
  productId: string
  productName: string
  sku: string
  /** Opaque unit key (`BAG:50`), sent back as the order line's unit. */
  unit: string
  /** "Bag · 50 kg", "Loose · kg". */
  comesIn: string
  pack: boolean
  left?: number | null
  /** In stock in the product's own unit, exactly; with `perUnit`, "12 bags + 100 g". */
  onHand?: number | null
  /** How many of the product's own unit one of this is (50 for a 50 kg bag, 1 loose). */
  perUnit: number
  stockState?: 'OK' | 'LOW' | 'OUT' | null
  coming?: number | null
  lastOrdered?: number | null
  /** The way it is normally bought from this supplier — the unit a line starts in. */
  usual: boolean
  /** What one of this unit cost from this supplier last time: the price a line starts with. */
  lastPrice?: number | null
  /** ISO day of that price. */
  lastPriceOn?: string | null
  /** PAID: a delivery came in at that price. ORDERED: an order agreed it. */
  lastPriceKind?: 'PAID' | 'ORDERED' | null
}

/** A supplier ordered from before: when, and a few of what. */
export interface RecentSupplier {
  vendorId: string
  lastOrderedAt: string
  products: string[]
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
  /** The branch it is going to ("Going to"); left out, the phone's branch. */
  branchId?: string
  /** Make it a purchase order: a number, a PDF, and something to send the supplier. */
  purchaseOrder?: boolean
  /** On a purchase order: also email it to the supplier now. */
  emailRequested?: boolean
  /** On a purchase order: already ordered by phone, so nothing is sent and it isn't waiting to be. */
  orderedByPhone?: boolean
  /** On a purchase order: what the supplier charges to bring it. Left out: not said. 0: free. */
  deliveryCharge?: number
  /** From someone who can only create orders: a note for whoever approves it. */
  approvalNote?: string
}

export interface ExpectedDeliveryListParams {
  /** Left out to list every status. The screen asks for OPEN. */
  status?: ExpectedDeliveryStatus
  view?: PurchaseOrderView
  search?: string
  vendorId?: string
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
