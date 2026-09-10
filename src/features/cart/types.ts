/**
 * Cart types (contract §4.6, §7, §8).
 *
 * One shared cart per *company*, not per user — a storekeeper builds it and an owner checks out —
 * which is why the server cart is authoritative for authenticated users and `addedByUsername`
 * exists at all: the cart page can show who put a line in.
 */

/** A cart line as `GET /api/cart` returns it, enriched with the catalog snapshot the UI needs. */
export interface CartItem {
  /** `cart_items.id`. Null for a line that only exists in the anonymous localStorage cart. */
  id: string | null
  productId: string
  productName: string
  productSku: string
  /** Used to build the `/product/:idOrSlug` link; falls back to the id when absent. */
  slug: string | null
  imageUrl: string | null
  unitPrice: number
  unitOfMeasure: string | null
  minOrderQuantity: number
  quantityOnHand: number
  /**
   * False when the product has been unlisted, deactivated or has gone out of stock since it was
   * added. Such a line stays visible — silently dropping it would be worse — but blocks checkout.
   */
  available: boolean
  quantity: number
  lineTotal: number
  addedByUserId: string | null
  addedByUsername: string | null
  /**
   * Who sells this line. A cart may hold several sellers' goods, and at checkout it splits into
   * one order per seller — so the cart page groups by this and shows a subtotal per group.
   *
   * Null only when the catalog row itself has vanished; such a line is already flagged
   * `available: false` and blocks checkout, so it is grouped under "Unavailable" rather than
   * attributed to nobody.
   */
  sellerId: string | null
  sellerName: string | null
  sellerLogoUrl: string | null
  sellerIsPlatformOwner: boolean
}

/**
 * One seller's slice of the cart — and therefore exactly one of the orders checkout will create.
 *
 * Derived on the client from `CartItem.sellerId` rather than returned by the API. That is a
 * deliberate split of responsibility: the SERVER owns the money (the authoritative per-seller
 * subtotals, delivery fees and totals come from the checkout quote, which is what the buyer is
 * actually charged), while this grouping exists only so the cart page can lay lines out under
 * headings. The `subtotal` here is a goods-only sum for display; it carries no delivery fee,
 * because whether a group clears the free-delivery threshold is the server's call and the cart
 * page must not guess at it.
 */
export interface CartSellerGroup {
  sellerId: string | null
  sellerName: string
  sellerLogoUrl: string | null
  platformOwner: boolean
  items: CartItem[]
  /** Goods only — see above. */
  subtotal: number
  itemCount: number
}

/**
 * Groups cart lines by seller, in a stable order: ProcurePal first, then sellers by name, with
 * unattributed (broken) lines last.
 *
 * ProcurePal leads for the same reason it leads in the checkout quote — it is the marketplace's
 * own inventory, not one vendor among the alphabetised rest — and the two orderings are kept
 * deliberately identical so the cart and the checkout summary list the same groups the same way
 * round. A buyer comparing the two screens should not have to re-find their place.
 */
export function groupCartBySeller(items: CartItem[]): CartSellerGroup[] {
  const groups = new Map<string, CartSellerGroup>()

  for (const item of items) {
    // Key on the id, not the name: two sellers may legitimately share a display name, and
    // collapsing them would show one heading over two different companies' goods.
    const key = item.sellerId ?? '__unattributed__'
    let group = groups.get(key)
    if (!group) {
      group = {
        sellerId: item.sellerId,
        sellerName: item.sellerName ?? 'Unavailable items',
        sellerLogoUrl: item.sellerLogoUrl,
        platformOwner: item.sellerIsPlatformOwner,
        items: [],
        subtotal: 0,
        itemCount: 0,
      }
      groups.set(key, group)
    }
    group.items.push(item)
    group.subtotal += item.lineTotal
    group.itemCount += item.quantity
  }

  return [...groups.values()].sort((a, b) => {
    if (a.sellerId === null) return 1
    if (b.sellerId === null) return -1
    if (a.platformOwner !== b.platformOwner) return a.platformOwner ? -1 : 1
    return a.sellerName.localeCompare(b.sellerName)
  })
}

export interface Cart {
  /** `carts.id`. Null for the anonymous cart, which has no server row. */
  id: string | null
  items: CartItem[]
  /** Sum of quantities — what the header badge shows. */
  itemCount: number
  /** Number of distinct products. */
  distinctItemCount: number
  subtotal: number
  updatedAt: string | null
}

export interface AddCartItemPayload {
  productId: string
  quantity: number
}

/** `POST /api/cart/merge` — the server sums quantities and clamps each line to its MOQ. */
export interface MergeCartPayload {
  items: AddCartItemPayload[]
}

export const EMPTY_CART: Cart = {
  id: null,
  items: [],
  itemCount: 0,
  distinctItemCount: 0,
  subtotal: 0,
  updatedAt: null,
}
