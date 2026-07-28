import type { OrderStatus } from '@/constants/orderStatus'
import { ordersApi } from '@/features/orders/api/ordersApi'
import type { Order, OrderSummary } from '@/features/orders/types'
import { isAppError } from '@/types/api'

/**
 * Where "incoming stock" comes from, and why this file exists.
 * ---------------------------------------------------------------------------------------------
 * The buyer's own `products` row carries an `incoming_quantity` column — goods paid for but not
 * yet physically received. It is the single most important number in the product: it is what lets
 * a company see "20 bags are coming" without those 20 bags being counted as usable stock.
 *
 * **`/api/products` (`ProductResponse`) does not currently expose that column.** The DTO predates
 * the marketplace migration (V6) that added it. Rather than invent a number client-side, this
 * module derives the *same* figure from the authoritative source the API does expose: the buyer's
 * own in-flight orders, where `OrderItemResponse.outstandingQuantity` is — per the backend's own
 * comment — "exactly the amount still sitting as incoming stock on the buyer's product row".
 *
 * That derivation is real server data, not a guess, and it buys something the column alone never
 * could: *which* orders are bringing the stock, so the inventory screens can link to them.
 *
 * The moment `ProductResponse.incomingQuantity` ships, `resolveIncoming()` below prefers it and
 * the list screens stop fetching order details at all (see `needsDerivation` in useIncomingStock).
 * This is a bridge that removes itself.
 */

/** One order contributing incoming stock for a product. */
export interface IncomingOrderLine {
  orderId: string
  orderNumber: string
  status: OrderStatus
  /** Outstanding units on this order for this product. */
  quantity: number
  /** The ProcurePal catalog product, for a "buy more" link back to the storefront. */
  catalogProductId: string
  unitOfMeasure?: string
  /** DELIVERED and not yet confirmed — the buyer's outstanding action. */
  awaitingReceipt: boolean
}

export interface IncomingStockEntry {
  /** Total units en route for this product. */
  quantity: number
  /** The subset already delivered and waiting on a receipt confirmation. */
  awaitingReceiptQuantity: number
  orders: IncomingOrderLine[]
}

export interface IncomingStockState {
  /** Keyed by the BUYER's product id (`OrderItem.buyerProductId`), i.e. the inventory row's id. */
  byProductId: Map<string, IncomingStockEntry>
  loading: boolean
  hasLoadedOnce: boolean
  error: string | null
  /**
   * True when there were more in-flight orders than we were willing to expand. The totals are
   * then a floor, not an exact figure, and the UI says "at least" rather than overstating.
   */
  truncated: boolean
}

/**
 * The statuses that hold incoming stock, most actionable first.
 *
 * PENDING_PAYMENT is excluded — nothing is reserved until payment lands. RECEIVED has nothing
 * outstanding by definition, and CANCELLED has handed its remainder back.
 *
 * Scanned status by status rather than as one unfiltered page, because the API's only filter is
 * single-valued and an account can easily carry hundreds of abandoned PENDING_PAYMENT checkouts
 * that would otherwise fill the first page and hide every order that actually owes stock.
 */
const INCOMING_STATUSES: readonly OrderStatus[] = [
  'DELIVERED',
  'OUT_FOR_DELIVERY',
  'PROCESSING',
  'CONFIRMED',
  'PLACED',
]

// Per-status scan depth, and how many of the resulting orders get expanded into line items.
// Bounded work: at most INCOMING_STATUSES.length list calls plus MAX_EXPANDED detail calls. The
// `truncated` flag keeps the copy honest ("at least N") when a company outruns that.
const PER_STATUS_SCAN_SIZE = 25
const MAX_EXPANDED = 20

const EMPTY_STATE: IncomingStockState = {
  byProductId: new Map(),
  loading: false,
  hasLoadedOnce: false,
  error: null,
  truncated: false,
}

/**
 * A module-level store rather than a React context, deliberately: the inventory list, the product
 * detail page and the low-stock card all want this data, and none of them may edit `App.tsx` to
 * add a provider (nine modules are editing this repo in parallel). One store means one fetch,
 * shared, and `invalidate()` after a receipt refreshes every subscriber at once.
 */
let state: IncomingStockState = EMPTY_STATE
let inFlight: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit(next: IncomingStockState) {
  state = next
  for (const listener of listeners) listener()
}

export function subscribeToIncomingStock(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getIncomingStockSnapshot(): IncomingStockState {
  return state
}

function buildMap(orders: Order[]): Map<string, IncomingStockEntry> {
  const map = new Map<string, IncomingStockEntry>()

  for (const order of orders) {
    for (const item of order.items) {
      // Without a buyerProductId there is no inventory row to attribute the stock to. That only
      // happens for an order whose incoming stock has not been applied yet, so skipping is right.
      if (!item.buyerProductId || item.outstandingQuantity <= 0) continue

      const entry = map.get(item.buyerProductId) ?? { quantity: 0, awaitingReceiptQuantity: 0, orders: [] }
      const awaitingReceipt = order.status === 'DELIVERED'
      entry.quantity += item.outstandingQuantity
      if (awaitingReceipt) entry.awaitingReceiptQuantity += item.outstandingQuantity
      entry.orders.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        quantity: item.outstandingQuantity,
        catalogProductId: item.productId,
        unitOfMeasure: item.unitOfMeasure,
        awaitingReceipt,
      })
      map.set(item.buyerProductId, entry)
    }
  }

  return map
}

/**
 * Loads (or reloads) the derivation. Concurrent callers share one request; a completed load is
 * reused until `invalidateIncomingStock()` is called — which the receive flow does, because
 * confirming a delivery is exactly the moment these numbers change.
 */
export function loadIncomingStock(force = false): Promise<void> {
  if (inFlight) return inFlight
  if (state.hasLoadedOnce && !force) return Promise.resolve()

  emit({ ...state, loading: true, error: null })

  inFlight = Promise.all(
    INCOMING_STATUSES.map((status) => ordersApi.list({ status, page: 0, size: PER_STATUS_SCAN_SIZE })),
  )
    .then(async (pages) => {
      // INCOMING_STATUSES is ordered most-actionable-first, and each page is newest-first, so
      // slicing off the head keeps the deliveries a buyer most needs to see rather than an
      // arbitrary sample.
      const open: OrderSummary[] = pages.flatMap((page) => page.content)
      const totalOpen = pages.reduce((sum, page) => sum + page.totalElements, 0)
      const expanded = open.slice(0, MAX_EXPANDED)
      const details = await Promise.all(expanded.map((summary) => ordersApi.get(summary.id)))
      emit({
        byProductId: buildMap(details),
        loading: false,
        hasLoadedOnce: true,
        error: null,
        truncated: totalOpen > expanded.length,
      })
    })
    .catch((err: unknown) => {
      // A buyer without VIEW_ORDERS gets a 403 here. That is not an error worth shouting about on
      // an inventory screen — they simply do not see incoming detail — so it is recorded, and the
      // consuming components render nothing rather than an alarming banner.
      emit({
        ...state,
        loading: false,
        hasLoadedOnce: true,
        error: isAppError(err) ? err.message : 'Could not load incoming deliveries.',
      })
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}

/** Forces the next `loadIncomingStock()` to re-fetch. Call after receiving or cancelling an order. */
export function invalidateIncomingStock(): void {
  emit({ ...state, hasLoadedOnce: false })
  void loadIncomingStock(true)
}

/** Clears everything on logout so the next tenant never sees the previous one's deliveries. */
export function resetIncomingStock(): void {
  inFlight = null
  emit(EMPTY_STATE)
}

export interface ResolvedIncoming {
  quantity: number
  awaitingReceiptQuantity: number
  orders: IncomingOrderLine[]
  /** True when the figure came from the product DTO and we have no per-order breakdown. */
  ordersUnknown: boolean
}

/**
 * The one place that decides what a product's incoming quantity is.
 *
 * `incomingQuantity` straight off the product row wins whenever the API sends it — it is the
 * authoritative column, and it counts orders beyond whatever window we scanned. The order-derived
 * figure is the fallback, and supplies the per-order breakdown either way.
 */
export function resolveIncoming(
  productId: string,
  dtoIncomingQuantity: number | undefined,
  state_: IncomingStockState,
): ResolvedIncoming {
  const entry = state_.byProductId.get(productId)
  const quantity = dtoIncomingQuantity ?? entry?.quantity ?? 0
  return {
    quantity,
    awaitingReceiptQuantity: entry?.awaitingReceiptQuantity ?? 0,
    orders: entry?.orders ?? [],
    ordersUnknown: quantity > 0 && !entry,
  }
}
