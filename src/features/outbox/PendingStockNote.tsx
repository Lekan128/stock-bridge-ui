import { CloudUpload, TriangleAlert } from 'lucide-react'
import { usePendingStock } from '@/features/outbox/useOutbox'
import { formatQuantity } from '@/features/products/unitCopy'

/**
 * "+20 kg waiting to send" beside a product's stock figure (A4). Kept apart from the figure, never
 * added to it — the same rule as "usable vs incoming": the number above is what the server has
 * confirmed, and this line is what this phone has recorded and not yet sent.
 */
export function PendingStockNote({ productId, stockUnit }: { productId: string; stockUnit: string }) {
  const pending = usePendingStock(productId)
  if (pending.waiting === 0) return null

  const parts: string[] = []
  if (pending.delta !== 0) parts.push(`${pending.delta > 0 ? '+' : '−'}${formatQuantity(Math.abs(pending.delta), stockUnit)}`)
  if (pending.count) parts.push(`a count of ${formatQuantity(pending.count.payload.countedQuantity, stockUnit)}`)
  const what = parts.length > 0 ? parts.join(' and ') : `${pending.waiting} change${pending.waiting === 1 ? '' : 's'}`

  return (
    <p
      role="status"
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
        pending.needsAttention
          ? 'border-warning-200 bg-warning-50 text-warning-800'
          : 'border-primary-100 bg-primary-50 text-primary-900'
      }`}
    >
      {pending.needsAttention ? (
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <CloudUpload className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span>
        {pending.needsAttention
          ? `${what} recorded on this phone could not be sent — open “needs you” at the top to decide.`
          : `${what} recorded on this phone, waiting to send. Not in the figure above yet.`}
      </span>
    </p>
  )
}
