import { PackageCheck, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface IncomingStockNoticeProps {
  /** Total units en route across the products shown. */
  units: number
  /** How many distinct products those units span. */
  productCount: number
  /** Units already delivered and waiting on a receipt confirmation. */
  awaitingReceiptUnits: number
  /** True when more orders were open than were expanded, so `units` is a floor. */
  approximate?: boolean
}

/**
 * The explainer at the top of the inventory list.
 *
 * Per-row badges tell you *which* products have stock coming. This says what "incoming" means at
 * all — the sentence most inventory software never writes down — and points at the one action
 * that converts it into usable stock.
 */
export function IncomingStockNotice({
  units,
  productCount,
  awaitingReceiptUnits,
  approximate = false,
}: IncomingStockNoticeProps) {
  if (units <= 0) return null

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-warning-200 bg-warning-50 p-4 sm:flex-row sm:items-center">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-100 text-warning-700">
        {awaitingReceiptUnits > 0 ? (
          <PackageCheck className="h-4.5 w-4.5" aria-hidden="true" />
        ) : (
          <Truck className="h-4.5 w-4.5" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-warning-900">
          {approximate ? 'At least ' : ''}
          {units} {units === 1 ? 'unit' : 'units'} across {productCount}{' '}
          {productCount === 1 ? 'product' : 'products'} {units === 1 ? 'is' : 'are'} on the way
        </p>
        <p className="mt-0.5 text-sm text-warning-800">
          Incoming stock is bought and paid for but has not arrived. It is shown so nobody re-orders something already
          on its way — it is <strong>not</strong> counted in your usable stock and cannot be picked or sold yet.
          {awaitingReceiptUnits > 0 && (
            <>
              {' '}
              <strong>{awaitingReceiptUnits}</strong> of those units have already been delivered and just need you to
              confirm receipt.
            </>
          )}
        </p>
      </div>
      <Link
        to={awaitingReceiptUnits > 0 ? '/app/orders?status=DELIVERED' : '/app/orders'}
        className="shrink-0 rounded-md border border-warning-300 bg-white px-3 py-2 text-center text-sm font-medium text-warning-900 hover:bg-warning-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-500"
      >
        {awaitingReceiptUnits > 0 ? 'Confirm deliveries' : 'View orders'}
      </Link>
    </div>
  )
}
