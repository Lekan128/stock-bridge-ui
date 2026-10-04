import { CloudUpload } from 'lucide-react'
import { usePendingStock } from '@/features/outbox/useOutbox'
import { formatNumber } from '@/features/products/unitCopy'

/**
 * A list row's "+20 waiting" (A4): stock recorded on this phone and not yet sent, beside — never
 * inside — the confirmed figure. Absent when nothing waits.
 */
export function PendingStockBadge({ productId }: { productId: string }) {
  const pending = usePendingStock(productId)
  if (pending.waiting === 0) return null
  const text =
    pending.delta !== 0
      ? `${pending.delta > 0 ? '+' : '−'}${formatNumber(Math.abs(pending.delta))} waiting`
      : pending.count
        ? 'count waiting'
        : 'waiting'
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${pending.needsAttention ? 'text-warning-700' : 'text-primary-700'}`}
      title="Recorded on this phone, not yet sent"
    >
      <CloudUpload className="h-3 w-3" aria-hidden="true" />
      {text}
    </span>
  )
}
