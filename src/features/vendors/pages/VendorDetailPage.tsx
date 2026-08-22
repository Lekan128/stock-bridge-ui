import { ArrowLeft, MapPin, Mail, Package, Phone, ReceiptText } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { buttonClassName } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { formatDateTime } from '@/features/products/formatters'
import { VendorKindBadge } from '@/features/vendors/components/VendorKindBadge'
import { useVendor } from '@/features/vendors/hooks/useVendor'
import type { VendorProductPrice } from '@/features/vendors/types'
import { formatNaira } from '@/utils/money'

/**
 * One supplier — `/app/vendors/:id`.
 *
 * Answers the two questions VENDOR_RESEARCH.md says make a vendor record worth more than a
 * contacts app: how much we have spent with them, and what we last paid them for each thing we
 * buy. Purchase history is deliberately NOT on this screen — it is paginated and it is its own
 * screen, linked from the header.
 */
export function VendorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { detail, loading, error, refetch } = useVendor(id)

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-56 w-full rounded-lg" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <ErrorState
        title="Could not load this vendor"
        message={error}
        onRetry={refetch}
        action={
          <Link to="/app/vendors" className={buttonClassName('secondary')}>
            Back to vendors
          </Link>
        }
      />
    )
  }

  const { vendor, platformVendor, spend, products } = detail

  // The live name for a VERIFIED entry, which is what makes a rename visible here even though the
  // list still shows the snapshot it sorts and searches on. See PlatformVendorSummary on the
  // server for the full ruling on why the two differ.
  const displayName = platformVendor?.name ?? vendor.name
  const renamed = !!platformVendor && platformVendor.name !== vendor.name
  const phone = platformVendor?.phone ?? vendor.contactPhone
  const email = platformVendor?.email ?? vendor.email
  const location = [platformVendor?.city ?? vendor.city, platformVendor?.state ?? vendor.state]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="mt-0.5 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{displayName}</h1>
              <VendorKindBadge kind={vendor.kind} />
            </div>
            {renamed && (
              // Said out loud rather than silently corrected: a buyer who filed an invoice under
              // the old name needs to know the two are the same company.
              <p className="mt-0.5 text-sm text-neutral-500">
                Listed in your directory as “{vendor.name}” — they have since renamed.
              </p>
            )}
          </div>
        </div>

        <Link to={`/app/vendors/${vendor.id}/purchases`} className={buttonClassName('secondary')}>
          <ReceiptText className="h-4 w-4" aria-hidden="true" />
          Purchase history
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 md:col-span-2">
          <h2 className="text-sm font-semibold text-neutral-900">Contact</h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
              <div>
                <dt className="text-neutral-500">Phone</dt>
                <dd className="text-neutral-900">{phone || '—'}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-neutral-500">Email</dt>
                <dd className="truncate text-neutral-900">{email || '—'}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2 sm:col-span-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
              <div>
                <dt className="text-neutral-500">Address</dt>
                <dd className="text-neutral-900">
                  {[vendor.addressLine1, vendor.addressLine2, location].filter(Boolean).join(', ') || '—'}
                </dd>
              </div>
            </div>
          </dl>

          {vendor.notes && (
            <div className="mt-4 border-t border-neutral-100 pt-3">
              <p className="text-sm text-neutral-500">Your notes</p>
              <p className="mt-0.5 text-sm whitespace-pre-line text-neutral-700">{vendor.notes}</p>
            </div>
          )}

          {vendor.kind === 'VERIFIED' && (
            <p className="mt-4 rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              These details come from this seller’s own ProcurePaddy account, so they stay current
              without anyone here maintaining them — which is also why they cannot be edited from your
              directory.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">Spend</h2>
          <dl className="mt-3 flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-neutral-500">Total spent</dt>
              <dd className="text-xl font-semibold text-neutral-900">{formatNaira(spend.totalSpend)}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Orders</dt>
              <dd className="font-medium text-neutral-900">{spend.orderCount}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Last purchase</dt>
              <dd className="font-medium text-neutral-900">
                {spend.lastPurchasedAt ? formatDateTime(spend.lastPurchasedAt) : '—'}
              </dd>
            </div>
          </dl>
          {vendor.kind === 'EXTERNAL' && (
            // Not an empty state to fix — a permanent, explained zero. Without this the reader
            // assumes the figures failed to load.
            <p className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
              You buy from this supplier outside ProcurePaddy, so there are no orders here to total.
            </p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Products supplied</h2>
        <p className="mt-0.5 mb-3 text-sm text-neutral-500">
          Items in your inventory filed under this supplier, with the last price you paid.
        </p>

        {products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products linked yet"
            description={
              vendor.kind === 'VERIFIED'
                ? 'Items you buy from this seller on the marketplace are linked here automatically when the order is placed. You can also link a product to them by hand from the product’s edit page.'
                : 'Link a product to this supplier from the product’s edit page, and what you buy from them will show up here.'
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium">On hand</th>
                  <th className="px-4 py-2.5 font-medium">Last price paid</th>
                  <th className="px-4 py-2.5 font-medium">Last bought</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {products.map((product) => (
                  <ProductRow key={product.productId} product={product} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function ProductRow({ product }: { product: VendorProductPrice }) {
  return (
    <tr>
      <td className="px-4 py-3">
        <Link to={`/app/products/${product.productId}`} className="font-medium text-neutral-900 hover:underline">
          {product.name}
        </Link>
        <p className="text-xs text-neutral-500">
          {product.sku}
          {product.unitOfMeasure ? ` · ${product.unitOfMeasure}` : ''}
        </p>
      </td>
      <td className="px-4 py-3 text-neutral-700">
        {product.quantityOnHand}
        {product.incomingQuantity > 0 && (
          <span className="ml-1 text-xs text-warning-700">(+{product.incomingQuantity} incoming)</span>
        )}
      </td>
      <td className="px-4 py-3">
        {/* An em dash, never ₦0.00. "We last paid nothing" is a different and false claim — see
            VendorProductPrice for the two ordinary ways the price is genuinely absent. */}
        {product.lastPurchaseUnitPrice === undefined ? (
          <span className="text-neutral-400" title="Never bought from this supplier through ProcurePaddy">
            —
          </span>
        ) : (
          <>
            <span className="font-medium text-neutral-900">{formatNaira(product.lastPurchaseUnitPrice)}</span>
            {product.lastPurchaseQuantity !== undefined && (
              <span className="block text-xs text-neutral-500">× {product.lastPurchaseQuantity} bought</span>
            )}
          </>
        )}
      </td>
      <td className="px-4 py-3 text-neutral-700">
        {product.lastPurchasedAt ? (
          <>
            <span>{formatDateTime(product.lastPurchasedAt)}</span>
            {product.lastPurchaseOrderId && (
              <Link
                to={`/app/orders/${product.lastPurchaseOrderId}`}
                className="block text-xs font-medium text-primary-600 hover:underline"
              >
                {product.lastPurchaseOrderNumber}
              </Link>
            )}
          </>
        ) : (
          <span className="text-neutral-400">—</span>
        )}
      </td>
    </tr>
  )
}
