import { useState } from 'react'
import { ArrowLeft, ReceiptText } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { formatDateTime } from '@/features/products/formatters'
import { VendorKindBadge } from '@/features/vendors/components/VendorKindBadge'
import { useVendor } from '@/features/vendors/hooks/useVendor'
import { useVendorPurchases } from '@/features/vendors/hooks/useVendorPurchases'
import type { VendorPurchase } from '@/features/vendors/types'
import { formatNaira } from '@/utils/money'

/**
 * Everything this company ever bought from one supplier — `/app/vendors/:id/purchases`.
 *
 * **Its own screen, on the stakeholder's explicit instruction**, and not a section of the vendor
 * detail page. That is also the right call technically: it is paginated, so folding it in would
 * either truncate it silently or make the detail screen pay for a page nobody scrolled to.
 *
 * Cancelled orders appear here even though they are excluded from the spend figures on the detail
 * screen. That is not an inconsistency: "we ordered from them and pulled out" is a fact about the
 * relationship worth seeing, and it is badged with its status so nobody reads it as money spent.
 */
export function VendorPurchaseHistoryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const { detail, loading: loadingVendor, error: vendorError, refetch: refetchVendor } = useVendor(id)
  const { data, loading, error, refetch } = useVendorPurchases(id, page)

  if (loadingVendor) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (vendorError || !detail) {
    return (
      <ErrorState
        title="Could not load this vendor"
        message={vendorError}
        onRetry={refetchVendor}
        action={
          <Link to="/app/vendors" className={buttonClassName('secondary')}>
            Back to vendors
          </Link>
        }
      />
    )
  }

  const { vendor, platformVendor } = detail
  const displayName = platformVendor?.name ?? vendor.name
  const purchases = data?.content ?? []

  return (
    <div className="flex flex-col gap-6">
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
            <h1 className="text-2xl font-semibold text-neutral-900">Purchase history</h1>
            <VendorKindBadge kind={vendor.kind} />
          </div>
          <p className="mt-0.5 text-sm text-neutral-500">
            Everything your company has ordered from{' '}
            <Link to={`/app/vendors/${vendor.id}`} className="font-medium text-primary-600 hover:underline">
              {displayName}
            </Link>
            .
          </p>
        </div>
      </div>

      {loading && <Skeleton className="h-64 w-full rounded-lg" />}

      {!loading && error && <ErrorState title="Could not load this purchase history" message={error} onRetry={refetch} />}

      {!loading && !error && purchases.length === 0 && (
        <EmptyState
          icon={ReceiptText}
          title={vendor.kind === 'EXTERNAL' ? 'No history to show for this supplier' : 'No purchases yet'}
          description={
            vendor.kind === 'EXTERNAL'
              ? // A permanent, explained empty state rather than "nothing found". This supplier is
                // off-platform by definition, so there is nothing to wait for and nothing broken —
                // and recording off-platform purchases by hand is not a feature that exists.
                'You buy from this supplier outside ProcurePaddy, so their orders do not pass through here. Purchase history is only recorded for sellers you order from on the marketplace.'
              : 'Once you place an order with this seller, every purchase will be listed here with what you paid.'
          }
        />
      )}

      {!loading && !error && purchases.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {purchases.map((purchase) => (
              <PurchaseCard key={purchase.orderId} purchase={purchase} />
            ))}
          </div>

          <Pagination page={data?.number ?? 0} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}

/**
 * One past order with its lines. Every figure is a snapshot taken at checkout, so a rename or a
 * repricing on the marketplace never changes what a past purchase says it cost.
 */
function PurchaseCard({ purchase }: { purchase: VendorPurchase }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/app/orders/${purchase.orderId}`}
            className="text-sm font-semibold text-neutral-900 hover:text-primary-700 hover:underline"
          >
            {purchase.orderNumber}
          </Link>
          <OrderStatusBadge status={purchase.status} />
          <span className="text-xs text-neutral-500">{formatDateTime(purchase.placedAt)}</span>
        </div>
        <span className="text-sm font-semibold text-neutral-900">{formatNaira(purchase.total)}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 font-medium">Unit price</th>
              <th className="px-4 py-2 font-medium">Qty</th>
              <th className="px-4 py-2 font-medium">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {purchase.lines.map((line) => (
              <tr key={line.orderItemId}>
                <td className="px-4 py-2.5">
                  <span className="text-neutral-900">{line.productName}</span>
                  <p className="text-xs text-neutral-500">
                    {line.productSku}
                    {line.unitOfMeasure ? ` · ${line.unitOfMeasure}` : ''}
                  </p>
                </td>
                <td className="px-4 py-2.5 text-neutral-700">{formatNaira(line.unitPrice)}</td>
                <td className="px-4 py-2.5 text-neutral-700">
                  {line.quantity}
                  {/* Partial receipt is normal in wholesale, and a line where 8 of 10 bags arrived
                      is a different fact from one that landed in full. */}
                  {line.receivedQuantity < line.quantity && (
                    <span className="block text-xs text-warning-700">{line.receivedQuantity} received</span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-medium text-neutral-900">{formatNaira(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-neutral-100 px-4 py-2.5 text-xs text-neutral-500">
        <span>Subtotal {formatNaira(purchase.subtotal)}</span>
        <span>Delivery {formatNaira(purchase.deliveryFee)}</span>
      </div>
    </div>
  )
}
