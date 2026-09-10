import { PackagePlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { formatDateTime } from '@/features/products/formatters'
import type { PurchaseHistoryEntry } from '@/features/purchases/types'
import { formatNaira } from '@/utils/money'

/**
 * One row of purchase history — a placed marketplace order or a manual stock-in, told apart by
 * `entry.source`. Every figure is a snapshot taken at the time (checkout for an order, the
 * delivery for a stock-in), so a later rename or repricing never changes what a past purchase
 * says it cost.
 *
 * `showVendor` names the supplier on the card itself — on, for the company-wide feed, which spans
 * every supplier; off for the per-vendor screen, which already says whose history this is in the
 * page header.
 */
export function PurchaseHistoryCard({
  entry,
  showVendor = false,
}: {
  entry: PurchaseHistoryEntry
  showVendor?: boolean
}) {
  const isOrder = entry.source === 'MARKETPLACE_ORDER'

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {isOrder ? (
            <Link
              to={`/app/orders/${entry.id}`}
              className="text-sm font-semibold text-neutral-900 hover:text-primary-700 hover:underline"
            >
              {entry.orderNumber}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
              <PackagePlus className="h-4 w-4 text-neutral-400" aria-hidden="true" />
              Manual stock-in
            </span>
          )}
          {entry.status ? (
            <OrderStatusBadge status={entry.status} />
          ) : (
            <Badge variant="neutral">Stock-in</Badge>
          )}
          {showVendor && entry.vendorName && (
            <Link
              to={`/app/vendors/${entry.companyVendorId}`}
              className="text-xs font-medium text-primary-600 hover:underline"
            >
              {entry.vendorName}
            </Link>
          )}
          <span className="text-xs text-neutral-500">{formatDateTime(entry.occurredAt)}</span>
        </div>
        <span className="text-sm font-semibold text-neutral-900">{formatNaira(entry.total)}</span>
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
            {entry.lines.map((line) => (
              <tr key={line.orderItemId ?? line.stockMovementId}>
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
                  {/* Partial receipt is a marketplace-order fact only — a manual stock-in has no
                      separate dispatch/receipt step, so receivedQuantity always equals quantity. */}
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

      {isOrder ? (
        <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-neutral-100 px-4 py-2.5 text-xs text-neutral-500">
          <span>Subtotal {formatNaira(entry.subtotal)}</span>
          <span>Delivery {formatNaira(entry.deliveryFee)}</span>
        </div>
      ) : (
        entry.note && (
          <p className="border-t border-neutral-100 px-4 py-2.5 text-xs text-neutral-500">Note: {entry.note}</p>
        )
      )}
    </div>
  )
}
