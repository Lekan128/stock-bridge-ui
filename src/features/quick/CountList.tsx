import { useEffect, useMemo, useRef, useState } from 'react'
import { useCountBoxes } from '@/features/products/useCountBoxes'
import { CountUnitLines } from '@/features/products/components/CountUnitLines'
import { Check } from 'lucide-react'
import { useCatalogList } from '@/features/catalog/useCatalog'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { Product } from '@/features/products/types'
import type { UnitOption } from '@/features/products/types'
import { formatNumber, stockUnitWord } from '@/features/products/unitCopy'
import {
  isCountedInWholeUnits,
  productsOwnUnits,
  resolveUnitSymbol,
  roundQuantity,
  unitOptionsForProduct,
} from '@/features/products/unitSet'
import { useOutboxState, usePendingStock } from '@/features/outbox/useOutbox'
import { submitStockWrite } from '@/features/outbox/outboxStore'
import { areaShortAs, figureInArea, type ShortAs } from '@/features/branches/areas'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { isAppError } from '@/types/api'

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
 * typed - what the app says the Kitchen has - so the eggs that came in and were used up are on the list too. Each row
 * is counted where it is (owner, 2026-11-09): tap its box, the phone's number keypad opens, type, Next - recorded, and
 * on to the next row. Below, what has been counted here since midnight, by anyone.
 */
export function CountList({
  areaId,
  areaName,
  countedHere,
  onPick,
  onCounted,
}: {
  areaId: string
  areaName: string
  /** Counted in this session, or waiting on this phone, before the catalogue hears of it. */
  countedHere: CountedHere[]
  /** A counted-today row tapped: count it again on its own screen. */
  onPick: (product: Product) => void
  /** A row counted in place: what it was recorded as, for This session and "Counted today". */
  onCounted: (counted: RowCounted) => void
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
            {rows.map((product, index) => (
              <CountRow
                key={product.id}
                product={product}
                areaId={areaId}
                areaName={areaName}
                onCounted={(entry) => {
                  onCounted(entry)
                  // Straight on to the next row's first box: type, Next, type, Next.
                  const next = rows[index + 1]
                  if (next) window.requestAnimationFrame(() => document.getElementById(boxId(next.id, 0))?.focus())
                }}
              />
            ))}
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
            {countedRows.map((row) => (
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
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** What a row counted in place was recorded as. */
export interface RowCounted {
  productId: string
  productName: string
  summary: string
  movementId?: string
  opId?: string
}

function boxId(productId: string, box: number): string {
  return `count-row-${productId}-${box}`
}

/**
 * One product counted on its row (owner, 2026-11-10): its name and what the app says, every unit it has as a round chip
 * - the ones it's counted in already on - and a box for each chip that's on, with what the app says shown faintly
 * inside, never filled in for them. Tap a chip to add or take away its box. Next on the phone's keypad goes to the next
 * box, then records. A shortfall says what it's recorded as: missing in a store; used in a kitchen, where a tap makes
 * it missing for this count.
 */
function CountRow({
  product,
  areaId,
  areaName,
  onCounted,
}: {
  product: Product
  areaId: string
  areaName: string
  onCounted: (counted: RowCounted) => void
}) {
  const { options } = useUnitOfMeasureOptions()
  const offered = productsOwnUnits(unitOptionsForProduct(product, options))
  const count = useCountBoxes(product, offered)
  const units: UnitOption[] = count.boxes.map((box) => box.unit)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [shortChosen, setShortChosen] = useState<ShortAs | null>(null)
  const savingRef = useRef(false)
  const symbol = resolveUnitSymbol(product.unitOfMeasure, options)
  const wholeOnly = isCountedInWholeUnits(product.unitOfMeasure, options)
  const area = (useOptionalWorkingBranch()?.branches ?? []).flatMap((b) => b.areas ?? []).find((a) => a.id === areaId)
  // Used only where stock is used bit by bit; a Store's shortfall is missing, with nothing to switch.
  const usedHere = area?.shortIsUsed === true
  const shortAs = usedHere ? (shortChosen ?? (area ? areaShortAs(area) : 'MISSING')) : 'MISSING'
  const pending = usePendingStock(product.id, areaId)
  const appSays = roundQuantity((figureInArea(product, areaId) ?? product.quantityOnHand) + pending.delta)

  // What the app says, faintly in the boxes: as many of the biggest unit as fit, then the next, the rest in the last.
  const hints: string[] = (() => {
    let left = appSays
    return units.map((unit, index) => {
      if (index === units.length - 1) return formatNumber(roundQuantity(left / unit.factorToStockUnit))
      const whole = Math.floor(left / unit.factorToStockUnit + 1e-9)
      left = roundQuantity(left - whole * unit.factorToStockUnit)
      return formatNumber(whole)
    })
  })()

  async function record() {
    if (savingRef.current) return
    if (!count.anyTyped) return setProblem('Type how many are here.')
    if (count.total == null) return setProblem('A number, to 3 decimal places.')
    const base = count.total
    if (wholeOnly && !Number.isInteger(base)) return setProblem(`That isn't a whole number of ${stockUnitWord(symbol, 2)}.`)
    const difference = roundQuantity(base - appSays)
    const counted = `${formatNumber(base)} ${stockUnitWord(symbol, base)}`
    const said =
      difference === 0
        ? 'matches'
        : difference > 0
          ? `${formatNumber(difference)} more`
          : `${formatNumber(-difference)} ${shortAs === 'USED' ? 'used' : 'missing'}`
    savingRef.current = true
    setSaving(true)
    setProblem(null)
    try {
      const outcome = await submitStockWrite({
        kind: 'COUNT',
        productId: product.id,
        productName: product.name,
        summary: counted,
        payload: { countedQuantity: base, areaId, shortAs: shortChosen ?? undefined },
      })
      onCounted({
        productId: product.id,
        productName: product.name,
        summary: `${counted} · ${said}`,
        ...(outcome.status === 'sent' ? { movementId: outcome.response.movement?.id } : { opId: outcome.op.id }),
      })
    } catch (err) {
      setProblem(isAppError(err) ? err.message : 'Could not record that. Try again.')
      savingRef.current = false
      setSaving(false)
    }
  }

  // The difference, live, before it's recorded: "30 kg short · used".
  const typedAny = count.anyTyped
  const preview = typedAny && count.total != null ? roundQuantity(count.total - appSays) : null

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3" data-count-row={product.name}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-base font-semibold text-neutral-900">{product.name}</span>
        <span className="shrink-0 text-sm text-neutral-500 tabular-nums" data-count-app-says>
          App: {formatNumber(appSays)} {stockUnitWord(symbol, appSays)}
        </span>
      </div>
      <CountUnitLines
        count={count}
        productName={product.name}
        stockSymbol={symbol}
        boxId={(index) => boxId(product.id, index)}
        onBox={(index, text) => {
          setProblem(null)
          count.setText(index, text)
        }}
        boxProps={(index) => ({
          placeholder: hints[index],
          enterKeyHint: index < units.length - 1 ? 'next' : 'done',
          disabled: saving,
          onKeyDown: (event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            if (index < units.length - 1) document.getElementById(boxId(product.id, index + 1))?.focus()
            else void record()
          },
        })}
      />
      {(problem || typedAny) && (
        <div className="flex items-center justify-between gap-2 text-sm">
          {problem ? (
            <p role="alert" className="min-w-0 flex-1 text-danger-700">
              {problem}
            </p>
          ) : preview != null ? (
            <p className="min-w-0 flex-1 text-neutral-700" data-count-preview>
              {preview === 0 ? (
                'Matches'
              ) : preview > 0 ? (
                `${formatNumber(preview)} ${stockUnitWord(symbol, preview)} more`
              ) : (
                <>
                  {formatNumber(-preview)} {stockUnitWord(symbol, -preview)} short ·{' '}
                  {usedHere ? (
                    // A kitchen's shortfall is used; a tap makes it missing for this count, and back.
                    <button
                      type="button"
                      onClick={() => setShortChosen(shortAs === 'USED' ? 'MISSING' : 'USED')}
                      aria-label={`${shortAs === 'USED' ? 'Used' : 'Missing'} from the ${areaName}. Tap to make it ${shortAs === 'USED' ? 'missing' : 'used'}`}
                      className="font-semibold text-primary-700 underline decoration-dotted underline-offset-2"
                    >
                      {shortAs === 'USED' ? 'used' : 'missing'}
                    </button>
                  ) : (
                    'missing'
                  )}
                </>
              )}
            </p>
          ) : (
            <span />
          )}
          {typedAny && (
            <button
              type="button"
              onClick={() => void record()}
              disabled={saving}
              className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-md bg-primary-600 px-3 font-semibold text-white hover:bg-primary-700"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      )}
    </li>
  )
}
