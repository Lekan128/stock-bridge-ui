import { useEffect, useMemo, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { useCatalogList } from '@/features/catalog/useCatalog'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { Product } from '@/features/products/types'
import { formatNumber, stockUnitWord } from '@/features/products/unitCopy'
import { resolveUnitSymbol } from '@/features/products/unitSet'
import { useOutboxState } from '@/features/outbox/useOutbox'
import { figureInArea } from '@/features/branches/areas'

/** Rows shown before "Show more": a kitchen's shelf, not a warehouse's. */
const PAGE = 60

/** This product counted here today, by this session or this phone - what the server doesn't know yet. */
export interface CountedHere {
  productId: string
  productName: string
  summary: string
  at: number
}

/**
 * The closing count of one area (STOCK_SHEETS_AND_AREA_COUNT_PLAN.md Part 5): the products appear before anything is
 * typed - what the app says the Kitchen has - so the eggs that came in and were used up are on the list too. Tap one,
 * type what's there, Record: the same step as a search result. Below, what has been counted here since midnight, by
 * anyone. No extra buttons on the rows, so the screen is as plain as the search results.
 */
export function CountList({
  areaId,
  areaName,
  countedHere,
  onPick,
  picked,
}: {
  areaId: string
  areaName: string
  /** Counted in this session, or waiting on this phone, before the catalogue hears of it. */
  countedHere: CountedHere[]
  onPick: (product: Product) => void
  /** The row being counted, opened in place (owner, 2026-11-09: no new screen) - its keypad and Record. */
  picked?: { productId: string; content: ReactNode } | null
}) {
  const { options } = useUnitOfMeasureOptions()
  const since = useMemo(() => {
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    return midnight.getTime()
  }, [])
  const base = { search: '', status: 'active' as const, categoryId: '', sort: { field: 'name' as const, direction: 'asc' as const } }
  const scope = useMemo(() => ({ areaIds: [areaId] }), [areaId])
  // What the area has now and hasn't been counted today; nothing at 0 - counting those can only find more.
  const toCount = useCatalogList({ ...base, stockStatus: 'OK', countedInArea: { areaId, since, counted: false } }, true, scope)
  const counted = useCatalogList({ ...base, stockStatus: 'all', countedInArea: { areaId, since, counted: true } }, true, scope)
  const { loadRange: loadToCount } = toCount
  const { loadRange: loadCounted } = counted
  useEffect(() => loadToCount(0, PAGE - 1), [loadToCount])
  useEffect(() => loadCounted(0, PAGE - 1), [loadCounted])

  // Counted on this phone, or still waiting to send, but not yet in the catalogue.
  const { ops } = useOutboxState()
  const waiting: CountedHere[] = ops
    .filter((op) => op.kind === 'COUNT' && op.payload.areaId === areaId)
    .map((op) => ({ productId: op.productId, productName: op.productName, summary: op.summary, at: op.createdAt }))
  const local = [...countedHere, ...waiting].filter((entry) => entry.at >= since)
  const localIds = new Set(local.map((entry) => entry.productId))

  const rows: Product[] = []
  for (let i = 0; i < Math.min(toCount.total, PAGE); i++) {
    const row = toCount.rowAt(i)
    if (row && !localIds.has(row.id)) rows.push(row)
  }
  const countedRows: { key: string; name: string; text: string; at: number | null; product?: Product }[] = local
    .filter((entry, index, all) => all.findIndex((other) => other.productId === entry.productId) === index)
    .map((entry) => ({ key: `local-${entry.productId}`, name: entry.productName, text: entry.summary, at: entry.at }))
  for (let i = 0; i < Math.min(counted.total, PAGE); i++) {
    const row = counted.rowAt(i)
    if (!row || localIds.has(row.id)) continue
    const figure = figureInArea(row, areaId) ?? 0
    const at = row.areaStock?.find((entry) => entry.areaId === areaId)?.lastCountedAt
    const unit = resolveUnitSymbol(row.unitOfMeasure, options)
    countedRows.push({ key: row.id, name: row.name, text: `${formatNumber(figure)} ${stockUnitWord(unit, figure)}`, at: at ? Date.parse(at) : null, product: row })
  }
  // The header counts what's still to count: those on the list, less any just counted here.
  const toCountTotal = Math.max(0, toCount.total - (Math.min(toCount.total, PAGE) - rows.length))
  if (!toCount.ready && !counted.ready) return null

  return (
    <div className="flex flex-col gap-4" data-count-list>
      <section aria-labelledby="to-count-heading" className="flex flex-col gap-2">
        <h2 id="to-count-heading" className="px-1 text-sm font-semibold text-neutral-700">
          To count in the {areaName} · {formatNumber(toCountTotal)}
        </h2>
        {rows.length === 0 ? (
          <p className="px-1 text-base text-neutral-600">Everything the {areaName} has is counted today.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((product) => {
              const figure = figureInArea(product, areaId) ?? product.quantityOnHand
              const unit = resolveUnitSymbol(product.unitOfMeasure, options)
              if (picked?.productId === product.id) {
                return (
                  <li key={product.id} className="rounded-lg border-2 border-primary-600 bg-white p-3" data-counting-here>
                    {picked.content}
                  </li>
                )
              }
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => onPick(product)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-left hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    <span className="min-w-0 truncate text-base font-semibold text-neutral-900">{product.name}</span>
                    <span className="shrink-0 text-right text-base font-semibold tabular-nums">
                      {formatNumber(figure)} <span className="text-sm font-normal text-neutral-500">{stockUnitWord(unit, figure)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {toCount.total > PAGE && <p className="px-1 text-sm text-neutral-600">Search for the rest.</p>}
      </section>

      {countedRows.length > 0 && (
        <section aria-labelledby="counted-today-heading" className="flex flex-col gap-2">
          <h2 id="counted-today-heading" className="px-1 text-sm font-semibold text-neutral-700">
            Counted today · {formatNumber(countedRows.length)}
          </h2>
          <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
            {countedRows.map((row) =>
              row.product && picked?.productId === row.product.id ? (
                <li key={row.key} className="p-3" data-counting-here>
                  {picked.content}
                </li>
              ) : (
              <li key={row.key}>
                <button
                  type="button"
                  disabled={!row.product}
                  onClick={() => row.product && onPick(row.product)}
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left disabled:cursor-default"
                >
                  <Check className="h-4 w-4 shrink-0 text-accent-700" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-base text-neutral-900">{row.name}</span>
                  <span className="shrink-0 text-sm text-neutral-600 tabular-nums">
                    {row.text}
                    {row.at != null && ` · ${new Date(row.at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                </button>
              </li>
              ),
            )}
          </ul>
        </section>
      )}
    </div>
  )
}
