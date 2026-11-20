import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { useToast } from '@/components/useToast'
import { CancelSalePanel, CancelStateBox } from '@/features/selling/sale/CancelSale'
import { CANCEL_ALONE_FOR_MS } from '@/features/selling/sale/cancelReasons'
import { receiptFromDetail } from '@/features/selling/sale/receipt'
import { ReceiptActions } from '@/features/selling/sale/ReceiptActions'
import { SaleReceiptCard } from '@/features/selling/sale/SaleReceipt'
import { salesReportApi } from '@/features/selling/sales/salesReportApi'
import type { SaleDetail } from '@/features/selling/sales/types'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSellingNav } from '@/features/selling/sellingNav'
import { isAppError } from '@/types/api'

/**
 * One sale's receipt, opened again (selling till Steps 2-3): from the Sales page, from My sales today, or
 * from a "Ada asks to cancel a sale" notification. Print or share it; cancel it, or ask to; and, for someone
 * who can cancel sales, approve or decline a request.
 */
export function SaleRecordPage({ id }: { id?: string } = {}) {
  const params = useParams<{ saleId: string }>()
  // Inside quick mode (owner, 2026-11-19) a paid table's receipt comes as `id`; back goes to the Tables there.
  const saleId = id ?? params.saleId
  const nav = useSellingNav()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, client } = useAuth()
  const { showToast } = useToast()
  const online = useOnlineStatus()
  const [sale, setSale] = useState<SaleDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!saleId) return
    let gone = false
    salesReportApi
      .sale(saleId)
      .then((answer) => !gone && setSale(answer))
      .catch((err: unknown) => !gone && setError(isAppError(err) ? err.message : "Couldn't load this sale."))
    return () => {
      gone = true
    }
  }, [saleId])

  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canCancelSales = permissions.includes(PERMISSIONS.CANCEL_SALES)
  const own = sale != null && user?.type === 'tenant' && sale.recordedByUserId === user.id
  const fresh = sale != null && Date.now() - new Date(sale.occurredAt).getTime() < CANCEL_ALONE_FOR_MS
  const live = sale ? sale.lines.filter((line) => !line.cancelled).length : 0
  const settled = sale?.cancelState === 'CANCELLED' || live === 0 || sale?.cancelState === 'REQUESTED'

  function back() {
    if (nav.quick) navigate(nav.tables)
    else if (location.key !== 'default') navigate(-1)
    else navigate(permissions.includes(PERMISSIONS.VIEW_ANALYTICS) ? '/app/sales' : '/app/sell/today')
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={back}
          aria-label="Back"
          className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-xl font-semibold text-neutral-900 lg:text-2xl">Receipt</h1>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger-700">
          {error}
        </p>
      )}
      {!sale && !error && <p className="text-sm text-neutral-500">Loading…</p>}
      {sale && (
        <>
          {sale.recordedByName && <p className="-mt-2 text-sm text-neutral-600">Recorded by {sale.recordedByName}</p>}
          <CancelStateBox
            sale={sale}
            canAnswer={canCancelSales}
            onAnswered={(next, approved) => {
              setSale(next)
              showToast(approved ? 'Sale cancelled. The stock is back.' : 'Kept. The sale stands.', 'success')
            }}
          />
          <SaleReceiptCard receipt={receiptFromDetail(sale, client?.name ?? 'Sale')} />
          <ReceiptActions receipt={receiptFromDetail(sale, client?.name ?? 'Sale')} />
          {!settled && (
            <div className="flex justify-center">
              <CancelSalePanel
                saleId={sale.saleId}
                canCancelNow={canCancelSales || (own && fresh)}
                canAsk={own && permissions.includes(PERMISSIONS.STOCK_OUT)}
                blocked={online ? null : 'You are offline. Cancel it when you are back online.'}
                onDone={(next, kind) => {
                  setSale(next)
                  showToast(kind === 'requested' ? 'Asked. A manager will see it.' : 'Sale cancelled. The stock is back.', 'success')
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
