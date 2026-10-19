import { useState } from 'react'
import { api } from '@/api/client'
import { formatDate } from '@/features/company/formatters'
import { formatMoney } from '@/features/selling/money'
import { isAppError } from '@/types/api'

interface PriceChange {
  oldUnitPrice?: number
  newUnitPrice?: number
  oldEnteredPrice?: number
  oldEnteredUnit?: string
  newEnteredPrice?: number
  newEnteredUnit?: string
  source: 'FORM' | 'IMPORT' | 'IMPORT_UNDO' | 'LEGACY_REVIEW'
  changedByName?: string
  changedAt: string
}

const SOURCE: Record<PriceChange['source'], string | null> = {
  FORM: null,
  IMPORT: 'from a sheet',
  IMPORT_UNDO: 'a sheet undone',
  LEGACY_REVIEW: 'an old price used',
}

function price(entered: number | undefined, enteredUnit: string | undefined, perStockUnit: number | undefined, stockUnit: string) {
  if (entered != null && enteredUnit) return `${formatMoney(entered)} / ${enteredUnit.toLowerCase()}`
  if (perStockUnit != null) return `${formatMoney(perStockUnit)} / ${stockUnit}`
  return 'no price'
}

/**
 * Who changed this product's selling price, and when (`SELLING_PRICE_PLAN.md` §4.5, §6.6) - behind
 * one line, because it is checked now and then, not read every visit. Loaded only when opened.
 */
export function PriceHistory({ productId, stockUnit }: { productId: string; stockUnit: string }) {
  const [open, setOpen] = useState(false)
  const [changes, setChanges] = useState<PriceChange[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && changes == null) {
      api
        .get<PriceChange[]>(`/api/products/${productId}/price-changes`)
        .then((r) => setChanges(r.data))
        .catch((err: unknown) => setError(isAppError(err) ? err.message : "Couldn't load the price history."))
    }
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="-my-1 inline-flex min-h-8 items-center rounded-sm text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        {open ? 'Hide price history' : 'Price history'}
      </button>
      {open && (
        <div className="mt-2">
          {error && <p className="text-xs text-danger-600">{error}</p>}
          {changes == null && !error && <p className="text-xs text-neutral-500">Loading…</p>}
          {changes?.length === 0 && <p className="text-xs text-neutral-500">The price hasn't been changed since it was set.</p>}
          {changes && changes.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {changes.map((change) => (
                <li key={change.changedAt} className="text-xs text-neutral-600">
                  <span className="text-neutral-800">
                    {price(change.oldEnteredPrice, change.oldEnteredUnit, change.oldUnitPrice, stockUnit)} →{' '}
                    {price(change.newEnteredPrice, change.newEnteredUnit, change.newUnitPrice, stockUnit)}
                  </span>
                  {' · '}
                  {change.changedByName ?? 'Someone'}, {formatDate(change.changedAt)}
                  {SOURCE[change.source] && ` · ${SOURCE[change.source]}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
