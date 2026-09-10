import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/useAuth'
import { useToast } from '@/components/useToast'
import { cartApi } from '@/features/cart/api/cartApi'
import { EMPTY_CART, type Cart, type CartItem } from '@/features/cart/types'
import { storefrontApi } from '@/features/storefront/api/storefrontApi'
import type { MarketplaceProduct } from '@/features/storefront/types'
import { isAppError } from '@/types/api'
import { cartStorage, type StoredCartLine } from '@/utils/storage'

export interface CartContextValue {
  items: CartItem[]
  /** Sum of line quantities — what the header badge renders. */
  itemCount: number
  subtotal: number
  isLoading: boolean
  /** Set when the last load or mutation failed. Mutations also toast, so this is for inline UI. */
  error: string | null
  /**
   * Whether this visitor may buy at all.
   *
   * False for exactly one audience: a signed-in VENDOR. A vendor sells on the marketplace and
   * does not buy from it — the VENDOR role holds neither BROWSE_MARKETPLACE nor PLACE_ORDERS,
   * so `/api/cart` answers 403 for them on every call. Two things follow, and both live here
   * rather than in each caller:
   *
   *  - The load effect below does not call the API for a vendor at all. Without that, every
   *    vendor page load would produce a "Could not load your cart" banner explaining a failure
   *    that is really a correct refusal.
   *  - Callers read this to drop the affordance entirely — the header cart button, the add-to-cart
   *    controls on the storefront. A vendor browsing the public catalogue (which is public, and
   *    which they should be able to see, not least to check their own listings) must not be
   *    offered a basket they can never check out.
   *
   * Anonymous visitors are TRUE: an anonymous cart is legitimate and merges on login, and the
   * server is what refuses at checkout if the account that logs in turns out to be a seller.
   */
  canShop: boolean
  /**
   * Adds to the cart, summing with any existing line for the same product. `product` is optional
   * and purely an optimisation: pass the catalog row you already have on screen and the anonymous
   * cart can render the new line without a round trip.
   *
   * None of these mutations reject. They roll back optimistically-applied state, toast the
   * failure and expose it via `error` — so a caller can safely `void addItem(...)` from an
   * onClick without risking an unhandled rejection.
   */
  addItem: (productId: string, quantity?: number, product?: MarketplaceProduct) => Promise<void>
  updateQuantity: (productId: string, quantity: number) => Promise<void>
  removeItem: (productId: string) => Promise<void>
  clear: () => Promise<void>
  refetch: () => void
}

export const CartContext = createContext<CartContextValue | null>(null)

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Recomputes the derived totals rather than trusting whatever the caller/server sent. The badge
 * and the subtotal have to agree with the lines actually on screen at all times, including
 * mid-optimistic-update when the server has not weighed in yet.
 */
function toCart(items: CartItem[], id: string | null, updatedAt: string | null): Cart {
  return {
    id,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    distinctItemCount: items.length,
    subtotal: round2(items.reduce((sum, item) => sum + item.lineTotal, 0)),
    updatedAt,
  }
}

function itemFromProduct(product: MarketplaceProduct, quantity: number): CartItem {
  return {
    id: null,
    productId: product.id,
    productName: product.name,
    productSku: product.sku,
    slug: product.slug,
    imageUrl: product.imageUrl,
    unitPrice: product.unitPrice,
    unitOfMeasure: product.unitOfMeasure,
    minOrderQuantity: product.minOrderQuantity ?? 1,
    quantityOnHand: product.quantityOnHand ?? 0,
    available: product.inStock !== false,
    quantity,
    lineTotal: round2(product.unitPrice * quantity),
    addedByUserId: null,
    addedByUsername: null,
    // Carried through from the catalog row so the ANONYMOUS cart groups by seller exactly as the
    // server-backed one does. Without this a visitor would see a flat list before signing in and a
    // grouped one after, which reads as the cart having changed during login.
    sellerId: product.seller?.id ?? null,
    sellerName: product.seller?.name ?? null,
    sellerLogoUrl: product.seller?.logoUrl ?? null,
    sellerIsPlatformOwner: product.seller?.platformOwner ?? false,
  }
}

/**
 * Stand-in for a stored line whose product could not be fetched — unlisted, deleted, or the API
 * was simply unreachable. Kept in the cart and flagged unavailable rather than dropped: quietly
 * deleting something the shopper chose is the worse failure, and checkout blocks on `available`.
 */
function unresolvedItem(productId: string, quantity: number): CartItem {
  return {
    id: null,
    productId,
    productName: 'Item no longer available',
    productSku: '',
    slug: null,
    imageUrl: null,
    unitPrice: 0,
    unitOfMeasure: null,
    minOrderQuantity: 1,
    quantityOnHand: 0,
    available: false,
    quantity,
    lineTotal: 0,
    addedByUserId: null,
    addedByUsername: null,
    // Unknown by definition — the product could not be fetched. Grouped under "Unavailable items"
    // rather than guessed at.
    sellerId: null,
    sellerName: null,
    sellerLogoUrl: null,
    sellerIsPlatformOwner: false,
  }
}

/** Narrows an unknown server response to a usable cart, so a 204 or an odd shape can't blank the UI. */
function normalizeServerCart(raw: Cart | undefined | null): Cart | null {
  if (!raw || !Array.isArray(raw.items)) return null
  const items = raw.items.map((item) => ({
    ...item,
    minOrderQuantity: item.minOrderQuantity ?? 1,
    available: item.available !== false,
    lineTotal: item.lineTotal ?? round2(item.unitPrice * item.quantity),
  }))
  return toCart(items, raw.id ?? null, raw.updatedAt ?? null)
}

function toStoredLines(items: CartItem[]): StoredCartLine[] {
  // Ids and quantities only. Prices are deliberately not persisted — a cached price that has since
  // changed is the classic way to show a shopper one number and charge them another.
  return items.map((item) => ({ productId: item.productId, quantity: item.quantity }))
}

function errorMessage(err: unknown, fallback: string): string {
  return isAppError(err) ? err.message : fallback
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isBootstrapping, isVendor } = useAuth()
  const { showToast } = useToast()
  const [cart, setCart] = useState<Cart>(EMPTY_CART)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // Catalog rows already fetched for the anonymous cart, so re-rendering or bumping a quantity
  // doesn't re-request a product we've already resolved this session.
  const productCache = useRef(new Map<string, MarketplaceProduct>())
  // Latest cart, readable from async callbacks without making them depend on render state —
  // two rapid quantity changes must not each build on a stale snapshot.
  const cartRef = useRef(cart)
  cartRef.current = cart

  const resolveProduct = useCallback(async (productId: string): Promise<MarketplaceProduct | null> => {
    const cached = productCache.current.get(productId)
    if (cached) return cached
    try {
      const product = await storefrontApi.product(productId)
      productCache.current.set(productId, product)
      return product
    } catch {
      return null
    }
  }, [])

  /**
   * Turns stored {productId, quantity} lines into renderable items by re-reading prices from the
   * catalog.
   *
   * One batched request for the whole cart, via `GET /api/marketplace/catalog?ids=a,b,c`, not one
   * request per line: a 30-line cart previously meant 30 round trips on every page load, on the
   * critical path of the header badge. The endpoint answers a `PageResponse` rather than an array
   * and caps at 100 ids, both of which `storefrontApi.catalogByIds` handles (it chunks and unwraps).
   *
   * A line whose product is absent from the response has been delisted, deactivated or deleted.
   * It stays in the cart, flagged unavailable and removable — silently dropping something the
   * shopper chose is the worse failure, and checkout already blocks on `available`.
   */
  const hydrateAnonymousCart = useCallback(
    async (lines: StoredCartLine[]): Promise<{ cart: Cart; failed: boolean }> => {
      if (lines.length === 0) return { cart: EMPTY_CART, failed: false }

      // Anything already resolved this session is reused; only the rest is fetched.
      const missing = lines.map((line) => line.productId).filter((id) => !productCache.current.has(id))
      let failed = false
      if (missing.length > 0) {
        try {
          const fetched = await storefrontApi.catalogByIds(missing)
          for (const [id, product] of fetched) productCache.current.set(id, product)
        } catch {
          // A transport failure must not empty the cart. The lines still render (as unavailable)
          // and `failed` lets the cart page show a retry banner instead of claiming every product
          // was delisted at once.
          failed = true
        }
      }

      const items = lines.map((line) => {
        const product = productCache.current.get(line.productId)
        return product ? itemFromProduct(product, line.quantity) : unresolvedItem(line.productId, line.quantity)
      })
      return { cart: toCart(items, null, cartStorage.read()?.updatedAt ?? null), failed }
    },
    [],
  )

  const persistAnonymous = useCallback((items: CartItem[]) => {
    cartStorage.write(toStoredLines(items))
  }, [])

  // Load — and, on the first authenticated load, merge. Merging lives inside the load effect
  // rather than in a separate one so login can never race a plain GET against the merge POST.
  useEffect(() => {
    // The session is still being restored from a refresh token; committing to "anonymous" now
    // would write a server cart's worth of state into localStorage.
    if (isBootstrapping) return

    let cancelled = false
    setIsLoading(true)
    setError(null)

    async function load() {
      // A vendor has no cart and cannot get one — see `canShop`. Answering with an empty cart
      // here rather than letting `/api/cart` 403 keeps a correct refusal from rendering as a
      // broken storefront on every page they open.
      if (isVendor) {
        if (!cancelled) setCart(EMPTY_CART)
        return
      }

      if (!isAuthenticated) {
        const stored = cartStorage.read()
        const { cart: hydrated, failed } = await hydrateAnonymousCart(stored?.items ?? [])
        if (!cancelled) {
          setCart(hydrated)
          if (failed) setError('We could not refresh prices for your cart. Some items may show as unavailable.')
        }
        return
      }

      const stored = cartStorage.read()
      const pending = stored?.items ?? []

      if (pending.length > 0) {
        try {
          const merged = normalizeServerCart(await cartApi.merge({ items: pending }))
          // Only clear once the server has definitely taken ownership of the lines.
          cartStorage.clear()
          if (!cancelled) {
            setCart(merged ?? EMPTY_CART)
            const count = pending.length
            showToast(
              `${count} item${count === 1 ? '' : 's'} from your cart ${count === 1 ? 'was' : 'were'} saved to your company cart.`,
              'success',
            )
          }
          if (merged) return
        } catch {
          // Merge failed — keep localStorage intact so a retry (or the next login) can try again,
          // and fall through to reading the server cart on its own.
        }
      }

      const serverCart = normalizeServerCart(await cartApi.get())
      if (!cancelled) setCart(serverCart ?? EMPTY_CART)
    }

    load()
      .catch((err: unknown) => {
        // A missing/failing cart endpoint must not take the storefront shell down with it: the
        // header renders an empty badge, and the cart page can show this error with a retry.
        if (!cancelled) {
          setCart(EMPTY_CART)
          setError(errorMessage(err, 'Could not load your cart.'))
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
    // showToast is stable (useCallback in ToastProvider); listing it would not change behaviour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isVendor, isBootstrapping, reloadToken, hydrateAnonymousCart])

  const applyServerCart = useCallback((raw: Cart | undefined | null): boolean => {
    const next = normalizeServerCart(raw)
    if (!next) return false
    setCart(next)
    return true
  }, [])

  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])

  /** Shared shape for the three mutations: apply optimistically, call the server, roll back on failure. */
  const runMutation = useCallback(
    async (optimistic: Cart | null, serverCall: (() => Promise<Cart | void>) | null, failureMessage: string) => {
      const previous = cartRef.current
      if (optimistic) setCart(optimistic)
      setError(null)

      if (!serverCall) return

      try {
        const response = await serverCall()
        if (!applyServerCart(response as Cart)) {
          // The server didn't echo the cart back; re-read rather than trusting the optimistic copy.
          refetch()
        }
      } catch (err) {
        setCart(previous)
        const message = errorMessage(err, failureMessage)
        setError(message)
        showToast(message, 'error')
      }
    },
    [applyServerCart, refetch, showToast],
  )

  const addItem = useCallback(
    async (productId: string, quantity = 1, product?: MarketplaceProduct) => {
      const current = cartRef.current
      const existing = current.items.find((item) => item.productId === productId)

      let optimisticItems: CartItem[] | null = null
      if (existing) {
        const nextQuantity = Math.max(existing.quantity + quantity, existing.minOrderQuantity)
        optimisticItems = current.items.map((item) =>
          item.productId === productId
            ? { ...item, quantity: nextQuantity, lineTotal: round2(item.unitPrice * nextQuantity) }
            : item,
        )
      } else {
        const resolved = product ?? productCache.current.get(productId) ?? null
        if (resolved) {
          productCache.current.set(productId, resolved)
          const nextQuantity = Math.max(quantity, resolved.minOrderQuantity ?? 1)
          optimisticItems = [...current.items, itemFromProduct(resolved, nextQuantity)]
        }
      }

      if (!isAuthenticated) {
        // No server to fall back on, so an unknown product has to be fetched before it can render.
        const items = optimisticItems ?? (await (async () => {
          const resolved = await resolveProduct(productId)
          const nextQuantity = Math.max(quantity, resolved?.minOrderQuantity ?? 1)
          return [
            ...current.items,
            resolved ? itemFromProduct(resolved, nextQuantity) : unresolvedItem(productId, nextQuantity),
          ]
        })())
        const next = toCart(items, null, new Date().toISOString())
        setCart(next)
        persistAnonymous(items)
        return
      }

      await runMutation(
        optimisticItems ? toCart(optimisticItems, current.id, current.updatedAt) : null,
        () => cartApi.addItem({ productId, quantity }),
        'Could not add that item to your cart.',
      )
    },
    [isAuthenticated, persistAnonymous, resolveProduct, runMutation],
  )

  const updateQuantity = useCallback(
    async (productId: string, quantity: number) => {
      const current = cartRef.current
      const existing = current.items.find((item) => item.productId === productId)
      if (!existing) return

      // Zero (or less) means "remove" — a stepper held down should empty the line, not 400.
      if (quantity <= 0) {
        const items = current.items.filter((item) => item.productId !== productId)
        if (!isAuthenticated) {
          setCart(toCart(items, null, new Date().toISOString()))
          persistAnonymous(items)
          return
        }
        await runMutation(
          toCart(items, current.id, current.updatedAt),
          () => cartApi.removeItem(productId),
          'Could not remove that item.',
        )
        return
      }

      const clamped = Math.max(quantity, existing.minOrderQuantity)
      const items = current.items.map((item) =>
        item.productId === productId
          ? { ...item, quantity: clamped, lineTotal: round2(item.unitPrice * clamped) }
          : item,
      )

      if (!isAuthenticated) {
        setCart(toCart(items, null, new Date().toISOString()))
        persistAnonymous(items)
        return
      }

      await runMutation(
        toCart(items, current.id, current.updatedAt),
        () => cartApi.updateItem(productId, clamped),
        'Could not update that quantity.',
      )
    },
    [isAuthenticated, persistAnonymous, runMutation],
  )

  const removeItem = useCallback(
    async (productId: string) => {
      const current = cartRef.current
      const items = current.items.filter((item) => item.productId !== productId)

      if (!isAuthenticated) {
        setCart(toCart(items, null, new Date().toISOString()))
        persistAnonymous(items)
        return
      }

      await runMutation(
        toCart(items, current.id, current.updatedAt),
        () => cartApi.removeItem(productId),
        'Could not remove that item.',
      )
    },
    [isAuthenticated, persistAnonymous, runMutation],
  )

  const clear = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(EMPTY_CART)
      cartStorage.clear()
      return
    }
    // DELETE /api/cart returns no body, so this always ends in a refetch via runMutation.
    await runMutation(EMPTY_CART, () => cartApi.clear(), 'Could not empty your cart.')
  }, [isAuthenticated, runMutation])

  const value: CartContextValue = {
    items: cart.items,
    itemCount: cart.itemCount,
    subtotal: cart.subtotal,
    isLoading,
    error,
    canShop: !isVendor,
    addItem,
    updateQuantity,
    removeItem,
    clear,
    refetch,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
