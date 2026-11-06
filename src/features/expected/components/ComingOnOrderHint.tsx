import { Link } from 'react-router-dom'
import { useApiQuery } from '@/data/useApiQuery'
import { expectedApi } from '@/features/expected/api/expectedApi'
import { expectedCopy } from '@/features/expected/copy'
import { quantityWords } from '@/features/expected/expected'
import type { ExpectedDelivery, PageResponse } from '@/features/expected/types'

/**
 * One line on Stock in when this product is still owed on an open purchase order: "4 bags coming on
 * PO-0002 from John's Stores · Receive that instead" (2026-11-05). Recording it here instead would
 * raise the stock and leave the order waiting, so it would be received twice. Nothing is blocked:
 * it is a way out, not a wall.
 */
export function ComingOnOrderHint({ productId, productName, onLeave }: { productId: string; productName: string; onLeave: () => void }) {
  const result = useApiQuery<PageResponse<ExpectedDelivery>>({
    queryKey: ['expected', 'list', 'coming-on', productId],
    queryFn: () => expectedApi.list({ view: 'OPEN', search: productName, page: 0, size: 10 }),
    fallbackError: expectedCopy.list.loadFailed,
    persist: false,
  })
  const order = (result.data?.content ?? []).find(
    (entry) => entry.receivable && entry.lines.some((line) => line.productId === productId && line.outstanding > 0),
  )
  if (!order) return null
  const line = order.lines.find((entry) => entry.productId === productId && entry.outstanding > 0)
  if (!line) return null

  return (
    <p className="rounded-md bg-primary-50 px-3 py-2 text-sm text-neutral-800">
      {expectedCopy.match.stockInHint(
        quantityWords(line.outstanding, line.comesIn).replace(/ \(.*\)$/, ''),
        order.poNumber ?? expectedCopy.match.anOrder,
        order.vendorName ?? expectedCopy.page.theSupplier,
      )}{' '}
      <Link
        to={`/app/products/receive?expected=${order.id}`}
        onClick={onLeave}
        className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
      >
        {expectedCopy.match.stockInLink}
      </Link>
    </p>
  )
}
