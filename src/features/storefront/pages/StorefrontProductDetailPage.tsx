import { useEffect, useState } from 'react'
import { Check, PackageSearch, ShoppingCart, Store, Truck, Warehouse, Zap } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Button, buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ProductPriceTag } from '@/components/ProductPriceTag'
import { QuantityStepper } from '@/components/QuantityStepper'
import { useCart } from '@/features/cart/hooks/useCart'
import { ProductImage } from '@/features/products/components/ProductImage'
import { StorefrontProductSkeleton } from '@/features/storefront/components/ProductDetailSkeleton'
import { ProductGridCard } from '@/features/storefront/components/ProductGridCard'
import { useMarketplaceSettings } from '@/features/storefront/hooks/useMarketplaceSettings'
import { useProductDetail } from '@/features/storefront/hooks/useProductDetail'
import { formatNaira, formatNairaWhole } from '@/utils/money'
import { formatQuantity } from '@/utils/units'

/**
 * Public product detail — route `/product/:idOrSlug`.
 *
 * The endpoint accepts either an id or a slug, so this page is reachable from a shared link
 * (slug) and from the cart (id) with no branching.
 *
 * Buy-now exists alongside add-to-cart because a wholesale reorder is usually a single line: the
 * cart page is a detour when the buyer already knows exactly what they want. It adds and then
 * routes straight to `/checkout`, which bounces an anonymous visitor through login and merges
 * their local cart on the way back.
 */
export function StorefrontProductDetailPage() {
  const { idOrSlug } = useParams<{ idOrSlug: string }>()
  const navigate = useNavigate()
  const { addItem } = useCart()
  const { settings } = useMarketplaceSettings()
  const { product, related, loading, error, notFound, refetch } = useProductDetail(idOrSlug)

  const [quantity, setQuantity] = useState(1)
  const [pending, setPending] = useState<'add' | 'buy' | null>(null)
  const [justAdded, setJustAdded] = useState(false)

  const moq = product?.minOrderQuantity ?? 1

  // Open at the MOQ, not at 1: the stepper would clamp 1 up on first interaction anyway, and a
  // line total computed from a quantity the buyer cannot actually order is misleading.
  useEffect(() => {
    setQuantity(moq)
  }, [moq, product?.id])

  async function handleAdd(mode: 'add' | 'buy') {
    if (!product) return
    setPending(mode)
    // addItem never rejects — failures roll back and toast inside CartContext.
    await addItem(product.id, quantity, product)
    setPending(null)
    if (mode === 'buy') {
      navigate('/checkout')
      return
    }
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 2500)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <StorefrontProductSkeleton />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          icon={PackageSearch}
          title="This product is no longer listed"
          description="ProcurePal may have delisted it, or the link may be out of date. The rest of the catalog is still here."
          action={
            <Link to="/" className={buttonClassName('primary')}>
              Browse the catalog
            </Link>
          }
        />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <ErrorState
          title="We could not load this product"
          message={error}
          onRetry={refetch}
          action={
            <Link to="/" className={buttonClassName('secondary')}>
              Back to the catalog
            </Link>
          }
        />
      </div>
    )
  }

  const canBuy = product.inStock && product.quantityOnHand >= moq
  const lineTotal = product.unitPrice * quantity
  const busy = pending !== null

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Breadcrumbs
        items={[
          { label: 'Marketplace', to: '/' },
          ...(product.categoryId && product.categoryName
            ? [{ label: product.categoryName, to: `/?categoryId=${product.categoryId}` }]
            : []),
          { label: product.name },
        ]}
      />

      <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:gap-10">
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            className="aspect-square w-full"
            iconClassName="h-16 w-16"
          />
        </div>

        <div className="min-w-0">
          {product.brand && (
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{product.brand}</p>
          )}
          <h1 className="mt-1 text-xl font-bold leading-tight text-neutral-900 sm:text-2xl">{product.name}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {product.inStock ? (
              <Badge variant="success">
                In stock · {formatQuantity(product.quantityOnHand, product.unitOfMeasure)}
              </Badge>
            ) : (
              <Badge variant="danger">Out of stock</Badge>
            )}
            {product.categoryName && <Badge variant="neutral">{product.categoryName}</Badge>}
            <span className="text-xs text-neutral-400">SKU {product.sku}</span>
          </div>

          <ProductPriceTag
            price={product.unitPrice}
            unitOfMeasure={product.unitOfMeasure}
            size="lg"
            layout="stacked"
            className="mt-5"
          />

          {product.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-neutral-600">{product.description}</p>
          )}

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-neutral-200 py-4 text-sm">
            <div>
              <dt className="text-xs text-neutral-500">Sold in</dt>
              <dd className="font-medium text-neutral-900">{product.unitOfMeasure || 'units'}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Minimum order</dt>
              <dd className="font-medium text-neutral-900">{formatQuantity(moq, product.unitOfMeasure)}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Availability</dt>
              <dd className="font-medium text-neutral-900">
                {product.inStock ? formatQuantity(product.quantityOnHand, product.unitOfMeasure) : 'None right now'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Category</dt>
              <dd className="font-medium text-neutral-900">{product.categoryName || 'Uncategorised'}</dd>
            </div>
          </dl>

          {canBuy ? (
            <div className="mt-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <label htmlFor="pdp-quantity" className="mb-1.5 block text-sm font-medium text-neutral-700">
                    Quantity
                  </label>
                  <QuantityStepper
                    id="pdp-quantity"
                    label="Quantity"
                    value={quantity}
                    onChange={setQuantity}
                    min={moq}
                    max={product.quantityOnHand}
                    unitOfMeasure={product.unitOfMeasure}
                    disabled={busy}
                  />
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-500">Line total</p>
                  <p className="text-lg font-semibold text-neutral-900">{formatNaira(lineTotal)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={() => handleAdd('add')}
                  loading={pending === 'add'}
                  disabled={busy}
                  className={`flex-1 ${justAdded ? 'bg-accent-600 hover:bg-accent-700 focus-visible:ring-accent-500' : ''}`}
                >
                  {justAdded ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Added to cart
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                      Add to cart
                    </>
                  )}
                </Button>
                {/* Emerald: this is the money action (design tokens — accent is buy/confirm). */}
                <Button
                  onClick={() => handleAdd('buy')}
                  loading={pending === 'buy'}
                  disabled={busy}
                  className="flex-1 bg-accent-600 hover:bg-accent-700 focus-visible:ring-accent-500"
                >
                  <Zap className="h-4 w-4" aria-hidden="true" />
                  Buy now
                </Button>
              </div>

              {justAdded && (
                <p aria-live="polite" className="mt-2 text-sm text-accent-700">
                  {formatQuantity(quantity, product.unitOfMeasure)} added.{' '}
                  <Link to="/cart" className="font-medium underline underline-offset-2">
                    View cart
                  </Link>
                </p>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-sm font-medium text-neutral-900">
                {product.inStock ? 'Not enough stock to meet the minimum order' : 'Currently out of stock'}
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                {product.inStock
                  ? `Only ${formatQuantity(product.quantityOnHand, product.unitOfMeasure)} remain, and this line is sold in minimums of ${formatQuantity(moq, product.unitOfMeasure)}.`
                  : 'ProcurePal is restocking this line. It stays listed so you can find it again.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/" className={buttonClassName('secondary')}>
                  <Store className="h-4 w-4" aria-hidden="true" />
                  Browse alternatives
                </Link>
                {settings.supportEmail && (
                  <a
                    href={`mailto:${settings.supportEmail}?subject=${encodeURIComponent(`Restock enquiry: ${product.sku}`)}`}
                    className={buttonClassName('secondary')}
                  >
                    Ask about restocking
                  </a>
                )}
              </div>
            </div>
          )}

          <ul className="mt-5 space-y-2 text-sm text-neutral-600">
            <li className="flex items-start gap-2">
              <Warehouse className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
              <span>
                Booked into your inventory as <strong className="font-medium text-neutral-900">incoming stock</strong>{' '}
                once the order is placed — usable once you confirm receipt.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
              <span>
                {settings.freeDeliveryThreshold > 0
                  ? `${formatNairaWhole(settings.deliveryFee)} delivery, free on orders over ${formatNairaWhole(settings.freeDeliveryThreshold)}.`
                  : `${formatNairaWhole(settings.deliveryFee)} delivery on every order.`}
              </span>
            </li>
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-neutral-900">You might also need</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {related.map((item) => (
              <ProductGridCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
