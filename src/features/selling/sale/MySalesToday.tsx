import { useEffect } from 'react'
import { api } from '@/api/client'
import { useAuth } from '@/auth/useAuth'
import { useApiQuery } from '@/data/useApiQuery'
import { useOutboxState } from '@/features/outbox/useOutbox'
import { formatMoney } from '@/features/selling/money'
import type { MySalesTotals } from '@/features/selling/types'

/**
 * "Your sales today: 14 · ₦86,500 · 2 waiting" (`SELLING_PRICE_PLAN.md` §6.3) - the figure a cashier
 * checks against their drawer at closing. The server's count of what it has, with sales still on
 * this phone said beside it and never added in (Pattern C): the two are different kinds of true.
 * Read again whenever a sale is recorded here or a waiting one reaches the server.
 */
export function MySalesToday({ refreshKey }: { refreshKey: number }) {
  const { user } = useAuth()
  const { ops, recentlySent } = useOutboxState()
  const today = new Date().toDateString()
  const { data, refetch, showingSaved, updatedAt } = useApiQuery<MySalesTotals>({
    queryKey: ['my-sales-today', user?.type === 'tenant' ? user.id : null, today],
    queryFn: () => api.get<MySalesTotals>('/api/sales/mine/summary').then((r) => r.data),
    fallbackError: "Couldn't load your sales today.",
    enabled: user?.type === 'tenant',
  })
  const lastSent = recentlySent[0]?.id
  useEffect(() => {
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, lastSent])

  const waiting = new Set(
    ops.flatMap((op) => (op.kind === 'STOCK_OUT' && op.status === 'pending' && op.payload.saleId ? [op.payload.saleId] : [])),
  ).size
  if (!data && waiting === 0) return null

  return (
    <p className="text-sm text-neutral-600 tabular-nums" aria-live="polite">
      Your sales today:{' '}
      <span className="font-semibold text-neutral-900">
        {data ? `${data.saleCount.toLocaleString()} · ${formatMoney(data.salesAmount)}` : '…'}
      </span>
      {waiting > 0 && ` · ${waiting} waiting to send`}
      {showingSaved && updatedAt != null &&
        ` (as of ${new Date(updatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })})`}
    </p>
  )
}
