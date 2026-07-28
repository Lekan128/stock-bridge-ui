import { useMemo, useState } from 'react'
import { ArrowRight, CircleAlert, Lock, ShoppingCart, Trash2, Warehouse } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Button, buttonClassName } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { CartLineRow } from '@/features/cart/components/CartLineRow'
import { CartSkeleton } from '@/features/cart/components/CartSkeleton'
import { FreeDeliveryNudge } from '@/features/cart/components/FreeDeliveryNudge'
import { useCart } from '@/features/cart/hooks/useCart'
import { useMarketplaceSettings } from '@/features/storefront/hooks/useMarketplaceSettings'
import { formatNaira, formatNairaWhole } from '@/utils/money'

/**
 * The cart — route `/cart`. Public: an anonymous visitor may build a cart before signing up, and
 * it is merged into the company cart on login (contract §8).
 *
 * The totals here are deliberately *indicative*: the authoritative delivery fee, minimum-order
 * check and blockers come from `POST /api/checkout/quote` one screen later, which needs an
 * authenticated company and a delivery address. Showing the settings-derived estimate anyway is
 * the right trade — a cart that says nothing about delivery until after login hides the real cost.
 */
export function CartPage() {
  const { isAuthenticated } = useAuth()
  const { items, itemCount, subtotal, isLoading, error, updateQuantity, removeItem, clear, refetch } = useCart()
  const { settings } = useMarketplaceSettings()
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)

  const unavailable = useMemo(() => items.filter((item) => !item.available), [items])
  const overStock = useMemo(
    () => items.filter((item) => item.available && item.quantityOnHand > 0 && item.quantity > item.quantityOnHand),
    [items],
  )

  const qualifiesForFreeDelivery = settings.freeDeliveryThreshold > 0 && subtotal >= settings.freeDeliveryThreshold
  const estimatedDelivery = qualifiesForFreeDelivery ? 0 : settings.deliveryFee
  const belowMinimum = settings.minimumOrderValue > 0 && subtotal < settings.minimumOrderValue

  // Every reason checkout is unavailable, as sentences — the UX bar forbids a silently inert CTA.
  const blockers: string[] = []
  if (unavailable.length > 0) {
    blockers.push(
      `${unavailable.length} item${unavailable.length === 1 ? ' is' : 's are'} no longer available. Remove ${unavailable.length === 1 ? 'it' : 'them'} to continue.`,
    )
  }
  if (overStock.length > 0) {
    blockers.push(
      `${overStock.length} line${overStock.length === 1 ? '' : 's'} exceed${overStock.length === 1 ? 's' : ''} the stock ProcurePal has on hand.`,
    )
  }
  if (belowMinimum) {
    blockers.push(`Orders start at ${formatNairaWhole(settings.minimumOrderValue)}. Add a little more to check out.`)
  }
  const canCheckout = items.length > 0 && blockers.length === 0

  async function handleClear() {
    setClearing(true)
    await clear()
    setClearing(false)
    setConfirmClear(false)
  }

  if (isLoading && items.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">Your cart</h1>
        <div className="mt-6">
          <CartSkeleton />
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">Your cart</h1>
        {error && <ErrorState variant="inline" message={error} onRetry={refetch} className="mt-4" />}
        <EmptyState
          className="mt-6"
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Everything you add here is priced wholesale and lands in your inventory as incoming stock once the order is placed."
          action={
            <Link to="/" className={buttonClassName('primary')}>
              Browse the catalog
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">Your cart</h1>
          <p aria-live="polite" className="mt-0.5 text-sm text-neutral-500">
            {itemCount} {itemCount === 1 ? 'unit' : 'units'} across {items.length}{' '}
            {items.length === 1 ? 'product' : 'products'}
            {isAuthenticated && ' · shared with your whole company'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setConfirmClear(true)} disabled={isLoading}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Empty cart
        </Button>
      </div>

      {error && <ErrorState variant="inline" message={error} onRetry={refetch} className="mt-4" />}

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        <div>
          {unavailable.length > 0 && (
            <div role="alert" className="mb-4 rounded-lg border border-danger-200 bg-danger-50 p-3.5">
              <p className="flex items-start gap-2 text-sm font-medium text-danger-800">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {unavailable.length === 1
                  ? 'One item in your cart is no longer available'
                  : `${unavailable.length} items in your cart are no longer available`}
              </p>
              <p className="mt-1 pl-6 text-sm text-danger-700">
                ProcurePal has delisted or run out of {unavailable.map((item) => item.productName).join(', ')}. Remove{' '}
                {unavailable.length === 1 ? 'it' : 'them'} and the rest of your cart can go through.
              </p>
              <div className="mt-2 pl-6">
                <button
                  type="button"
                  onClick={() => {
                    for (const item of unavailable) void removeItem(item.productId)
                  }}
                  className="rounded text-sm font-medium text-danger-800 underline underline-offset-2 hover:text-danger-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500"
                >
                  Remove {unavailable.length === 1 ? 'it' : 'them all'}
                </button>
              </div>
            </div>
          )}

          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white px-4">
            {items.map((item) => (
              <CartLineRow
                key={item.productId}
                item={item}
                onQuantityChange={(productId, quantity) => void updateQuantity(productId, quantity)}
                onRemove={(productId) => void removeItem(productId)}
              />
            ))}
          </ul>

          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-1.5 rounded text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Continue shopping
          </Link>
        </div>

        <aside className="mt-8 lg:sticky lg:top-20 lg:mt-0">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-900">Order summary</h2>

            <FreeDeliveryNudge
              subtotal={subtotal}
              deliveryFee={settings.deliveryFee}
              freeDeliveryThreshold={settings.freeDeliveryThreshold}
              className="mt-3"
            />

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-neutral-600">Subtotal</dt>
                <dd className="font-medium text-neutral-900">{formatNaira(subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-neutral-600">Delivery (estimated)</dt>
                <dd className={`font-medium ${qualifiesForFreeDelivery ? 'text-accent-700' : 'text-neutral-900'}`}>
                  {qualifiesForFreeDelivery ? 'Free' : formatNaira(estimatedDelivery)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-100 pt-2">
                <dt className="font-semibold text-neutral-900">Estimated total</dt>
                <dd className="text-lg font-bold text-neutral-900">{formatNaira(subtotal + estimatedDelivery)}</dd>
              </div>
            </dl>
            <p className="mt-1.5 text-xs text-neutral-500">
              Delivery is confirmed at checkout, once you pick a delivery address.
            </p>

            <div className="mt-4">
              {canCheckout ? (
                <Link to="/checkout" className={`${buttonClassName('primary')} w-full`}>
                  Proceed to checkout
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <>
                  <Button disabled className="w-full" aria-describedby="cart-blockers">
                    Proceed to checkout
                  </Button>
                  <ul id="cart-blockers" className="mt-2 space-y-1">
                    {blockers.map((blocker) => (
                      <li key={blocker} className="flex items-start gap-1.5 text-xs text-danger-600">
                        <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                        {blocker}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {!isAuthenticated && (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-neutral-500">
                <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                You will be asked to sign in — your cart comes with you.
              </p>
            )}
          </div>

          <div className="mt-3 rounded-lg border border-warning-200 bg-warning-50 p-3.5">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-warning-900">
              <Warehouse className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Once this order is placed, these items appear in your inventory as{' '}
                <strong className="font-semibold">incoming stock</strong>. They only become usable stock when you
                confirm you have received the delivery.
              </span>
            </p>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Empty your cart?"
        message={
          isAuthenticated
            ? 'This removes every item from your company cart — anyone else on your team will see it emptied too. This cannot be undone.'
            : 'This removes every item from your cart. This cannot be undone.'
        }
        confirmLabel="Empty cart"
        loading={clearing}
        onConfirm={() => void handleClear()}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
