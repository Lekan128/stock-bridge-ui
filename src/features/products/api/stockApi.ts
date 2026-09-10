import { api } from '@/api/client'
import type {
  PageResponse,
  StockAdjustmentPayload,
  StockInPayload,
  StockMovement,
  StockMutationResponse,
  StockOutBreakdownLine,
  StockOutPayload,
} from '@/features/products/types'

/**
 * One delivery still on the shelf — `GET /api/products/{productId}/lots`, pinned by
 * `UNIT_UX_CONTRACT.md` §4.
 *
 * <h2>Why this endpoint exists, and what it replaced</h2>
 * `UNIT_UX_REMEDIATION_PLAN.md` §3's P1-5: the stock-out lot picker read the first 50 rows of
 * movement *history* and filtered them to `IN`. History is a log, and a picker needs a balance —
 * so it offered fully-consumed lots as though they were available, showed no remaining quantity
 * on any of them, and missed every lot past page 50. The user picked blind and was answered with
 * a 409. A lot's balance is derived (its received quantity minus the allocations against it,
 * `MULTI_VENDOR_INVENTORY_DESIGN.md` §5.2a) and no page of history carries that derivation, so
 * it is done once, on the server, and published here.
 *
 * <h2>Every number here is in the product's stock unit</h2>
 * `quantity` and `remaining` are base units; `unitPriceAtTime` is money per ONE base unit. That
 * is what the ledger stores (contract §3.2) and this response deliberately does not convert —
 * the caller knows the product's unit set and converts for display. It is also why a stock-out
 * `allocations[].quantity` is in base units too (§4): the rows and the lots they draw from are
 * quoted in the same terms, which is exactly what P1-4 got wrong.
 *
 * Ordered `(occurredAt, createdAt)` — the same FIFO order a stock-out consumes in, so "the first
 * row" and "what the server would have picked" are the same delivery.
 */
export interface ProductLot {
  /** The lot itself — the `IN` `StockMovement`. A stock-out allocation addresses this id. */
  inMovementId: string
  /** When the delivery ARRIVED, not when it was typed in. The FIFO sort key. */
  occurredAt: string
  /** Null for a lot recorded before any supplier was on file — the API omits null fields, so
   *  compare with `== null` and never assume the key is present. */
  companyVendorId?: string | null
  companyVendorName?: string | null
  /** Base units received on this delivery. */
  quantity: number
  /** Base units of it not yet consumed by any stock-out. Never negative. The ceiling on what an
   *  allocation row may draw from this lot. */
  remaining: number
  /** What was paid per stock unit, frozen at receipt. Null when the delivery had no price. */
  unitPriceAtTime?: number | null
  /**
   * The human name of this lot — `"3 Jan 2026 · Dangote Nigeria Plc"`, **composed by the server
   * and rendered verbatim**. `UNIT_UX_CONTRACT.md` §4 says so in as many words, and the reason is
   * non-negotiable 6: `inMovementId` is the only unambiguous handle on a lot, so a UI left to
   * name one itself eventually prints the UUID. The server's error copy names lots with the same
   * string, so a 409 reads as being about the row the user actually clicked.
   */
  label: string
}

/**
 * `StockInPayload` plus `saveAsSupplierDefault` — contract §3.4 / §7.7's explicit opt-in.
 *
 * <h3>Why the field is declared here rather than on `StockInPayload`</h3>
 * `features/products/types.ts` belongs to the UI-foundation module and is frozen; this file and
 * the two stock modals are the only things that send a stock-in. Extending the payload at the one
 * boundary that transmits it keeps the addition inside the module that needs it, and the
 * `extends` means a plain `StockInPayload` still satisfies the call — every existing caller is
 * unaffected, per non-negotiable 8. Fold it into `StockInPayload` proper when that file is next
 * open.
 */
export interface StockInRequestPayload extends StockInPayload {
  /**
   * Whether this delivery's pack should ALSO become the supplier's standing default.
   *
   * Absent and `false` both mean "touch nothing", and that is the state the checkbox ships
   * unchecked in. Plan §3's P0-5: the modal's help text promised *"the vendor's default stays
   * unchanged"* while `ProductVendorService.findOrCreateForReceipt` overwrote it from the very
   * fields that text was describing. The backend now honours the promise; this flag is how a
   * user deliberately breaks it. `lastCostPrice` is deliberately not behind it — a price paid is
   * a running fact about the relationship, not a configuration choice somebody makes.
   */
  saveAsSupplierDefault?: boolean
}

/**
 * A stock-out breakdown line that carries the server's own name for the lot it drew from.
 *
 * Same rule as {@link ProductLot.label} and the same reason (contract §4): the receipt that says
 * where the stock came from must name a delivery with the identical phrase the picker and the
 * error copy use, or it reads as being about a different delivery. Optional because the API omits
 * null fields and a response predating the field must still render — the caller falls back to
 * supplier + date, which is what it composed before this existed.
 */
export interface LabelledStockOutBreakdownLine extends StockOutBreakdownLine {
  label?: string
}

/** A stock-out response whose breakdown lines carry {@link LabelledStockOutBreakdownLine.label}. */
export interface StockOutResponse extends StockMutationResponse {
  breakdown?: LabelledStockOutBreakdownLine[]
}

export const stockApi = {
  stockIn: (productId: string, payload: StockInRequestPayload) =>
    api.post<StockMutationResponse>(`/api/products/${productId}/stock/stock-in`, payload).then((r) => r.data),

  stockOut: (productId: string, payload: StockOutPayload) =>
    api.post<StockOutResponse>(`/api/products/${productId}/stock/stock-out`, payload).then((r) => r.data),

  adjust: (productId: string, payload: StockAdjustmentPayload) =>
    api.post<StockMutationResponse>(`/api/products/${productId}/stock/adjustment`, payload).then((r) => r.data),

  history: (productId: string, page: number, size = 10) =>
    api
      .get<PageResponse<StockMovement>>(`/api/products/${productId}/stock/history`, { params: { page, size } })
      .then((r) => r.data),

  /**
   * The open deliveries a stock-out can draw from — contract §4. Not paged, and deliberately so:
   * this is a picker's source, and only lots with something left in them are ever candidates, so
   * the list is bounded by how much stock is genuinely on the shelf rather than by how long the
   * product has existed.
   *
   * @param open filter to lots with `remaining > 0`. The server's default and the picker's only
   *   sensible value; passed explicitly so the URL states what it is asking for.
   */
  lots: (productId: string, open = true) =>
    api.get<ProductLot[]>(`/api/products/${productId}/lots`, { params: { open } }).then((r) => r.data),
}
