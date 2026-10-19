import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/useToast'
import { formatCurrency } from '@/components/analytics/formatters'
import { sellingApi } from '@/features/selling/sellingApi'
import type { LegacyPriceRow, SellingSettings } from '@/features/selling/types'
import { isAppError } from '@/types/api'

const PAGE_SIZE = 50

export interface LegacyPriceReviewSheetProps {
  total: number
  onClose: () => void
  onUpdated: (settings: SellingSettings) => void
}

/**
 * "Check your old prices" (`SELLING_PRICE_PLAN.md` §4.6.3). Products had a "unit price" before
 * selling existed - some typed as selling prices, some copied in from what was paid - and nobody can
 * tell which from the number alone. So nothing is used without the owner choosing it: each old price
 * sits beside what the product costs, so a cost copied in as a price reads as exactly that.
 *
 * Use the ticked ones, use them all, or "Not now" - which keeps every old price where it is and only
 * stops the offer coming back.
 */
export function LegacyPriceReviewSheet({ total, onClose, onUpdated }: LegacyPriceReviewSheetProps) {
  const { showToast } = useToast()
  const [rows, setRows] = useState<LegacyPriceRow[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    sellingApi
      .legacyPrices(page, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return
        setRows((current) => (page === 0 ? result.content : [...current, ...result.content]))
        setHasMore(page + 1 < result.totalPages)
      })
      .catch((err: unknown) => !cancelled && setError(isAppError(err) ? err.message : "Couldn't load the old prices."))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page])

  function toggle(id: string) {
    setChosen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function run(action: () => Promise<SellingSettings>, done: (settings: SellingSettings) => string) {
    setSaving(true)
    setError(null)
    try {
      const settings = await action()
      onUpdated(settings)
      showToast(done(settings), 'success')
      onClose()
    } catch (err) {
      setError(isAppError(err) ? err.message : "Couldn't save that. Try again.")
      setSaving(false)
    }
  }

  const adoptChosen = () =>
    run(
      () => sellingApi.adoptLegacyPrices({ productIds: [...chosen] }),
      () => `${chosen.size} selling price${chosen.size === 1 ? '' : 's'} set.`,
    )
  const adoptAll = () => run(() => sellingApi.adoptLegacyPrices({ all: true }), () => `${total.toLocaleString()} selling prices set.`)
  const notNow = () => run(sellingApi.dismissLegacyPrices, () => 'Old prices kept aside. You can check them any time from Company.')

  return (
    <Sheet
      open
      onClose={onClose}
      size="lg"
      title="Old prices"
      footer={
        <>
          <Button variant="secondary" onClick={() => void notNow()} disabled={saving}>
            Not now
          </Button>
          <Button variant="secondary" onClick={() => void adoptAll()} disabled={saving}>
            Use all {total.toLocaleString()}
          </Button>
          <Button variant="action" onClick={() => void adoptChosen()} disabled={saving || chosen.size === 0} loading={saving}>
            Use {chosen.size || ''} as selling price{chosen.size === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-600">
          These products had a price before selling was on. Some may be what you sell them for, some what you paid.
          Tick the ones that are selling prices. Prices are for one stock unit (a kg, a piece).
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger-600">
            {error}
          </p>
        )}
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {rows.map((row) => {
            // Equal to what it costs: almost certainly copied in from a purchase, not a selling price.
            const looksLikeCost = row.costPrice != null && Math.abs(row.costPrice - row.legacyUnitPrice) < 0.005
            return (
              <li key={row.productId}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-neutral-50">
                  <input
                    type="checkbox"
                    checked={chosen.has(row.productId)}
                    onChange={() => toggle(row.productId)}
                    className="h-4 w-4 rounded text-primary-600 focus:ring-primary-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-neutral-900">{row.name}</span>
                    <span className="block text-xs text-neutral-500">
                      {row.costPrice != null ? `Costs ${formatCurrency(row.costPrice)}` : 'No cost recorded'}
                      {looksLikeCost && ' · same as its cost'}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-neutral-900">
                    {formatCurrency(row.legacyUnitPrice)}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        {loading && <p className="text-sm text-neutral-500">Loading…</p>}
        {!loading && hasMore && (
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="self-start rounded-sm text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Show more ({rows.length.toLocaleString()} of {total.toLocaleString()})
          </button>
        )}
      </div>
    </Sheet>
  )
}
