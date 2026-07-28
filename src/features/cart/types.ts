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
