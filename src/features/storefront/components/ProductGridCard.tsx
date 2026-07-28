import { useState } from 'react'
import { Check, ShoppingCart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { useCart } from '@/features/cart/hooks/useCart'
import { ProductImage } from '@/features/products/components/ProductImage'
import type { MarketplaceProduct } from '@/features/storefront/types'
import { formatNaira } from '@/utils/money'
import { formatPerUnit, formatQuantity } from '@/utils/units'

/** Where a catalog row points. Slugs are the shareable form; the id is the fallback. */
function productPath(product: Pick<MarketplaceProduct, 'id' | 'slug'>): string {
  return `/product/${product.slug || product.id}`
}

/** Below this the card nudges "only N left" — enough to matter to a buyer sizing an order. */
const LOW_STOCK_THRESHOLD = 20

export interface ProductGridCardProps {
  product: MarketplaceProduct
}

/**
 * One product in the catalog grid.
 *
 * Out-of-stock products stay on the grid rather than being filtered away (contract §10): a
 * wholesale buyer needs to know ProcurePal carries the line at all, and hiding it just makes the
 * catalog look thin. They are badged and the add button is replaced, not merely greyed.
 *
 * Add-to-cart adds the MOQ, not 1 — adding a quantity the server would immediately clamp is a
 * lie about what just happened to the cart.
 */
export function ProductGridCard({ product }: ProductGridCardProps) {
  const { addItem } = useCart()
  const [adding, setAdding] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  const moq = product.minOrderQuantity ?? 1
  const canBuy = product.inStock && product.quantityOnHand >= moq

  async function handleAdd() {
    setAdding(true)
    // addItem never rejects — it rolls back and toasts internally (see CartContext).
    await addItem(product.id, moq, product)
    setAdding(false)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 2000)
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white transition-shadow hover:shadow-md">
      <Link
        to={productPath(product)}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
      >
        <div className="relative">
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            className="aspect-[4/3] w-full"
            iconClassName="h-10 w-10"
          />
          {!product.inStock && (
            <span className="absolute left-2 top-2">
              <Badge variant="danger">Out of stock</Badge>
            </span>
          )}
          {product.inStock && product.quantityOnHand <= LOW_STOCK_THRESHOLD && (
            <span className="absolute left-2 top-2">
              <Badge variant="warning">Only {formatQuantity(product.quantityOnHand, product.unitOfMeasure)} left</Badge>
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        {product.brand && (
          <p className="truncate text-xs font-medium uppercase tracking-wide text-neutral-400">{product.brand}</p>
        )}
        <h3 className="mt-0.5 text-sm font-semibold leading-snug text-neutral-900">
          <Link
            to={productPath(product)}
            className="line-clamp-2 rounded hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {product.name}
          </Link>
        </h3>

        <div className="mt-2">
          <p className="text-base font-semibold text-neutral-900">{formatNaira(product.unitPrice)}</p>
          <p className="text-xs text-neutral-500">{formatPerUnit(product.unitOfMeasure)}</p>
        </div>

        {/* MOQ is a commercial constraint, not a detail — a buyer who only wants one of something
            sold in tens should learn that here, not at the quantity stepper. */}
        <p className="mt-1.5 text-xs text-neutral-500">
          {moq > 1 ? `Minimum order ${formatQuantity(moq, product.unitOfMeasure)}` : 'No minimum order'}
        </p>

        <div className="mt-3 flex-1" />

        {canBuy ? (
          <Button
            variant="primary"
            onClick={handleAdd}
            loading={adding}
            aria-label={`Add ${product.name} to cart`}
            className={`w-full ${justAdded ? 'bg-accent-600 hover:bg-accent-700 focus-visible:ring-accent-500' : ''}`}
          >
            {justAdded ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                Added
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Add to cart
              </>
            )}
          </Button>
        ) : (
          // Disabled with a stated reason (UX bar): "why can't I buy this" is answered in place.
          <div>
            <Button variant="secondary" disabled className="w-full" aria-describedby={`${product.id}-unavailable`}>
              Unavailable
            </Button>
            <p id={`${product.id}-unavailable`} className="mt-1.5 text-center text-xs text-neutral-500">
              {product.inStock
                ? `Only ${formatQuantity(product.quantityOnHand, product.unitOfMeasure)} left — below the ${formatQuantity(moq, product.unitOfMeasure)} minimum.`
                : 'Out of stock. Check back soon.'}
            </p>
          </div>
        )}
      </div>
    </article>
  )
}
