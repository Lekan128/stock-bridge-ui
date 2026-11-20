import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { draftsReady, loadDraft, subscribeDrafts } from '@/features/drafts/draftStore'
import { BASKETS_DRAFT_KEY, type Basket } from '@/features/selling/sale/useSaleBasket'

/**
 * "2 sales waiting for payment · Open" (selling till Step 1 fixes): baskets left on this phone - a customer
 * still finding their money when the cashier went somewhere else. Shown on Inventory and the Dashboard, so
 * a sale started by mistake-then-left is never forgotten.
 */
export function WaitingSalesLine() {
  const ready = useSyncExternalStore(subscribeDrafts, draftsReady, draftsReady)
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const look = () =>
      void loadDraft<{ baskets?: Basket[] }>(BASKETS_DRAFT_KEY).then((draft) => {
        if (!cancelled) setCount((draft?.value?.baskets ?? []).filter((basket) => basket.lines.length > 0).length)
      })
    look()
    const stop = subscribeDrafts(look)
    return () => {
      cancelled = true
      stop()
    }
  }, [ready])
  if (count === 0) return null
  return (
    <p className="flex items-center justify-between gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-2.5 text-sm font-medium text-warning-900">
      <span>
        {count} {count === 1 ? 'sale' : 'sales'} waiting for payment
      </span>
      <Link to="/app/sell" className="-my-2 inline-flex min-h-11 items-center font-semibold text-primary-700 hover:underline">
        Open
      </Link>
    </p>
  )
}
