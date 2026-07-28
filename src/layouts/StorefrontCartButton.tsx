import { ShoppingCart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCart } from '@/features/cart/hooks/useCart'

/**
 * Header cart link with its live item count.
 *
 * The count is always visible, at every breakpoint — on a phone it is the only signal that a cart
 * is being built at all. `aria-live="polite"` on the count satisfies the accessibility bar: adding
 * to cart from a product tile changes nothing else on screen, so without it the action is silent
 * to a screen-reader user.
 */
export function StorefrontCartButton({ className = '' }: { className?: string }) {
  const { itemCount } = useCart()
  const label = itemCount === 1 ? '1 item in cart' : `${itemCount} items in cart`

  return (
    <Link
      to="/cart"
      aria-label={`Cart, ${label}`}
      className={`relative flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${className}`}
    >
      <span className="relative">
        <ShoppingCart className="h-5 w-5" aria-hidden="true" />
        {itemCount > 0 && (
          <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent-600 px-1 text-[10px] font-semibold leading-none text-white">
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        )}
      </span>
      <span className="hidden lg:inline">Cart</span>
      <span aria-live="polite" className="sr-only">
        {label}
      </span>
    </Link>
  )
}
