import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { useApiQuery } from '@/data/useApiQuery'
import { formatNumber } from '@/features/products/unitCopy'
import { formatMoney } from '@/features/selling/money'
import { CANCEL_REASON_LABELS } from '@/features/selling/sale/cancelReasons'
import { paymentLabel } from '@/features/selling/sale/paymentMethod'
import { salesReportApi } from '@/features/selling/sales/salesReportApi'
import type { SalesReport } from '@/features/selling/sales/types'

/**
 * My sales today (selling till Step 3): the cashier's own sales, newest first - each opens to its receipt to
 * print again, share, or cancel. Cancelled ones stay, struck through; one waiting for a manager says so.
 */
export function MySalesTodayPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data, error } = useApiQuery<SalesReport>({
    queryKey: ['my-sales-list', user?.type === 'tenant' ? user.id : null, new Date().toDateString()],
    queryFn: () => salesReportApi.mine(),
    fallbackError: "Couldn't load your sales today.",
    enabled: user?.type === 'tenant',
  })

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/app/sell')}
          aria-label="Back to Record a sale"
          className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-xl font-semibold text-neutral-900 lg:text-2xl">My sales today</h1>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger-700">
          {error}
        </p>
      )}
      {data && (
        <>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-neutral-600">
              {formatNumber(data.totals.saleCount)} {data.totals.saleCount === 1 ? 'sale' : 'sales'}
            </span>
            <span className="text-2xl font-semibold text-neutral-900 tabular-nums">{formatMoney(data.totals.salesAmount)}</span>
          </div>
          {data.rows.length === 0 ? (
            <p className="text-sm text-neutral-600">No sales yet today.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white" aria-label="My sales today">
              {data.rows.map((row) => {
                const cancelled = row.cancelState === 'CANCELLED' || (row.totals.lineCount === 0 && row.totals.cancelledLineCount > 0)
                const time = row.occurredAt ? new Date(row.occurredAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''
                const amount = cancelled
                  ? formatMoney(row.totals.salesAmount || 0)
                  : formatMoney(row.totals.salesAmount)
                return (
                  <li key={row.key}>
                    <button
                      type="button"
                      onClick={() => navigate(`/app/sales/${row.key}`)}
                      className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                    >
                      <span className="min-w-0">
                        <span className={`block text-base font-medium tabular-nums ${cancelled ? 'text-neutral-500 line-through' : 'text-neutral-900'}`}>
                          {cancelled ? 'Cancelled' : amount} · {paymentLabel(row.paymentMethod)}
                        </span>
                        <span className="block truncate text-sm text-neutral-500">
                          {time}
                          {row.detail && ` · ${row.detail}`}
                          {cancelled && row.cancelReason && ` · ${CANCEL_REASON_LABELS[row.cancelReason]}`}
                        </span>
                      </span>
                      {row.cancelState === 'REQUESTED' ? (
                        <span className="shrink-0 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-semibold text-warning-800">Waiting for a manager</span>
                      ) : (
                        <span className="shrink-0 text-sm font-semibold text-primary-700">Open</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
