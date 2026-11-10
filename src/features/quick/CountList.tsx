import { useEffect, useMemo, useRef, useState } from 'react'
import { countedAsText, useCountBoxes, type CountedLine } from '@/features/products/useCountBoxes'
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
  /** As it was typed (V85), for Count again. */
  countedAs?: CountedLine[]
}

/**
 * The closing count of one place (STOCK_SHEETS_AND_AREA_COUNT_PLAN.md Part 5): the products appear before anything is
 * typed - what the app says the Kitchen has - so the eggs that came in and were used up are on the list too. Each row
 * is counted where it is (owner, 2026-11-09): tap its box, the phone's number keypad opens, type, Next - recorded, and
 * on to the next row. Below, what has been counted here since midnight, by anyone.
 *
 * The place is an area of a branch with areas, or a branch's only area, unnamed (owner, 2026-11-10: "if the branch
 * only has one area the count must be there"). Cards in a narrow space (a phone, quick mode); a table where there's
 * room (the Count stock page on a laptop) - the same rows either way.
 */
export function CountList({
  areaId,
  areaName,
  countedHere,
  onCounted,
  search = '',
  categoryId = '',
}: {
  areaId: string
  /** The area's name at a branch with areas; absent for a branch's only area, which isn't named. */
  areaName?: string
  /** Counted in this session, or waiting on this phone, before the catalogue hears of it. */
  countedHere: CountedHere[]
  /** A row counted in place: what it was recorded as, for This session and "Counted today". */
  onCounted: (counted: RowCounted) => void
  /** The Count stock page's search: what's at 0 is found too, since it's asked for by name. */
  search?: string
  /** The Count stock page's category: one shelf at a time. */
  categoryId?: string
}) {
  const { options } = useUnitOfMeasureOptions()
  const since = useMemo(() => {
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    return midnight.getTime()
  }, [])
  const base = { search, status: 'active' as const, categoryId, sort: { field: 'name' as const, direction: 'asc' as const } }
  // A named area's own figures; a branch's only area holds the branch's, so the branch's are read.
  const scope = useMemo(() => (areaName ? { areaIds: [areaId] } : undefined), [areaId, areaName])
  // What the place has now - low included - and hasn't been counted today; nothing at 0 - counting those can only find
  // more - unless it's searched for.
  const toCount = useCatalogList(
    { ...base, stockStatus: 'all', onlyHeld: !search.trim(), countedInArea: { areaId, since, counted: false } },
    true,
    scope,
  )
  const counted = useCatalogList({ ...base, stockStatus: 'all', countedInArea: { areaId, since, counted: true } }, true, scope)
  const { loadRange: loadToCount } = toCount
  const { loadRange: loadCounted } = counted
  useEffect(() => loadToCount(0, PAGE - 1), [loadToCount])
  useEffect(() => loadCounted(0, PAGE - 1), [loadCounted])

  // Counted on this phone, or still waiting to send, but not yet in the catalogue.
  const { ops } = useOutboxState()
  const waiting: CountedHere[] = ops
    // A branch's only area: a count sent without naming it is its too.
    .filter((op) => op.kind === 'COUNT' && (op.payload.areaId === areaId || (!areaName && !op.payload.areaId)))
    .map((op) => ({
      productId: op.productId,
      productName: op.productName,
      summary: op.summary,
      at: op.createdAt,
      countedAs: op.kind === 'COUNT' ? op.payload.countedAs : undefined,
    }))
  const local = [...countedHere, ...waiting].filter((entry) => entry.at >= since)
  const localIds = new Set(local.map((entry) => entry.productId))

  // Every product seen on either list, so one counted on this phone can be counted again in place.
  const seen = useRef(new Map<string, Product>())
  const rows: Product[] = []
  for (let i = 0; i < Math.min(toCount.total, PAGE); i++) {
    const row = toCount.rowAt(i)
    if (row) seen.current.set(row.id, row)
    if (row && !localIds.has(row.id)) rows.push(row)
  }
  const countedRows: { key: string; productId: string; name: string; text: string; at: number | null; countedAs?: CountedLine[] }[] = local
    .filter((entry, index, all) => all.findIndex((other) => other.productId === entry.productId) === index)
    .map((entry) => ({
      key: `local-${entry.productId}`,
      productId: entry.productId,
      name: entry.productName,
      text: entry.summary,
      at: entry.at,
      countedAs: entry.countedAs,
    }))
  for (let i = 0; i < Math.min(counted.total, PAGE); i++) {
    const row = counted.rowAt(i)
    if (row) seen.current.set(row.id, row)
    if (!row || localIds.has(row.id)) continue
    const figure = figureInArea(row, areaName ? areaId : undefined) ?? row.quantityOnHand
    const mark = countMark(row, areaId)
    const unit = resolveUnitSymbol(row.unitOfMeasure, options)
    // As it was typed - "1 bag + 2 kg" - when the count sent its lines; else what the place has now.
    const typed = countedAsText(mark?.countedAs, productsOwnUnits(unitOptionsForProduct(row, options)), unit)
    countedRows.push({
      key: row.id,
      productId: row.id,
      name: row.name,
      text: typed ?? `${formatNumber(figure)} ${stockUnitWord(unit, figure)}`,
      at: mark?.at ? Date.parse(mark.at) : null,
      countedAs: mark?.countedAs,
    })
  }
  // The counted row being counted again, in place.
  const [again, setAgain] = useState<string | null>(null)
  // The header counts what's still to count: those on the list, less any just counted here.
  const toCountTotal = Math.max(0, toCount.total - (Math.min(toCount.total, PAGE) - rows.length))
  if (!toCount.ready && !counted.ready) return null

  return (
    <div className="@container flex flex-col gap-4" data-count-list>
      <section aria-labelledby="to-count-heading" className="flex flex-col gap-2">
        <h2 id="to-count-heading" className="px-1 text-sm font-semibold text-neutral-700">
          {areaName ? `To count in the ${areaName}` : 'To count'} · {formatNumber(toCountTotal)}
        </h2>
        {rows.length === 0 ? (
          <p className="px-1 text-base text-neutral-600">
            {search.trim()
              ? 'Nothing to count matches that.'
              : areaName
                ? `Everything the ${areaName} has is counted today.`
                : 'Everything here is counted today.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 @3xl:gap-0 @3xl:divide-y @3xl:divide-neutral-100 @3xl:overflow-hidden @3xl:rounded-lg @3xl:border @3xl:border-neutral-200 @3xl:bg-white">
            {/* Column names, on a wide screen only, where the rows line up as a table. */}
            <li aria-hidden="true" className="hidden @3xl:grid @3xl:grid-cols-[minmax(0,1.3fr)_8rem_minmax(0,1.6fr)_minmax(0,1.1fr)] @3xl:gap-4 @3xl:bg-neutral-50 @3xl:px-4 @3xl:py-2 @3xl:text-xs @3xl:font-medium @3xl:text-neutral-500">
              <span>Product</span>
              <span>App says</span>
              <span>Counted</span>
              <span />
            </li>
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
        {toCount.total > PAGE && <p className="px-1 text-sm text-neutral-600">Search, or pick a category, for the rest.</p>}
      </section>

      {countedRows.length > 0 && (
        <section aria-labelledby="counted-today-heading" className="flex flex-col gap-2">
          <h2 id="counted-today-heading" className="px-1 text-sm font-semibold text-neutral-700">
            Counted today · {formatNumber(countedRows.length)}
          </h2>
          <ul className="flex flex-col gap-2">
            {countedRows.map((row) => {
              const product = seen.current.get(row.productId)
              if (again === row.productId && product) {
                // Counted again where it is (owner, 2026-11-10): its lines as they were typed, filled in.
                return (
                  <CountRow
                    key={row.key}
                    product={product}
                    areaId={areaId}
                    areaName={areaName}
                    initial={row.countedAs}
                    card
                    onCancel={() => setAgain(null)}
                    onCounted={(entry) => {
                      setAgain(null)
                      onCounted(entry)
                    }}
                  />
                )
              }
              return (
                <li key={row.key} className="flex min-h-12 items-center gap-3 rounded-lg border border-neutral-200 bg-white py-2 pr-2 pl-4" data-counted-row={row.name}>
                  <Check className="h-4 w-4 shrink-0 text-accent-700" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base text-neutral-900">{row.name}</p>
                    <p className="text-sm text-neutral-600 tabular-nums">
                      {row.text}
                      {row.at != null && ` · ${new Date(row.at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                  </div>
                  {product && (
                    <button
                      type="button"
                      onClick={() => {
                        setAgain(row.productId)
                        window.requestAnimationFrame(() => document.getElementById(boxId(row.productId, 0))?.focus())
                      }}
                      aria-label={`Count ${row.name} again`}
                      className="min-h-11 shrink-0 rounded-md px-3 text-sm font-semibold text-primary-700 hover:bg-primary-50"
                    >
                      Count again
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

/** The place's last count of the product: when, and as typed. Read from the catalogue's marks, else the area's figure. */
function countMark(product: Product, areaId: string): { at?: string; countedAs?: CountedLine[] } | undefined {
  const mark = product.counts?.find((entry) => entry.areaId === areaId)
  if (mark) return mark
  const figure = product.areaStock?.find((entry) => entry.areaId === areaId)
  return figure?.lastCountedAt ? { at: figure.lastCountedAt, countedAs: figure.lastCountedAs } : undefined
}

/** What a row counted in place was recorded as. */
export interface RowCounted {
  productId: string
  productName: string
  summary: string
  /** As it was typed (V85), for Count again. */
  countedAs?: CountedLine[]
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
  initial,
  onCancel,
  onCounted,
  card = false,
}: {
  product: Product
  areaId: string
  /** Absent for a branch's only area: not named, and its figure is the branch's. */
  areaName?: string
  /** A card on its own (counting again), not a line of the table on a wide screen. */
  card?: boolean
  /** Counting again: the last count's lines, filled in. */
  initial?: CountedLine[]
  /** Counting again: back to the counted line, nothing recorded. */
  onCancel?: () => void
  onCounted: (counted: RowCounted) => void
}) {
  const { options } = useUnitOfMeasureOptions()
  const offered = productsOwnUnits(unitOptionsForProduct(product, options))
  const count = useCountBoxes(product, offered, initial)
  const units: UnitOption[] = count.boxes.map((box) => box.unit)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [shortChosen, setShortChosen] = useState<ShortAs | null>(null)
  const savingRef = useRef(false)
  const symbol = resolveUnitSymbol(product.unitOfMeasure, options)
  const wholeOnly = isCountedInWholeUnits(product.unitOfMeasure, options)
  const area = (useOptionalWorkingBranch()?.branches ?? []).flatMap((b) => b.areas ?? []).find((a) => a.id === areaId)
  // Used only where stock is used bit by bit, at a branch with areas; a Store's shortfall is missing, with nothing to
  // switch - and so is a branch's only area's, as the server records it.
  const usedHere = !!areaName && area?.shortIsUsed === true
  const shortAs = usedHere ? (shortChosen ?? (area ? areaShortAs(area) : 'MISSING')) : 'MISSING'
  const pending = usePendingStock(product.id, areaName ? areaId : undefined)
  const appSays = roundQuantity((figureInArea(product, areaName ? areaId : undefined) ?? product.quantityOnHand) + pending.delta)

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
    const total = `${formatNumber(base)} ${stockUnitWord(symbol, base)}`
    // Read back as it was typed - "1 bag + 2 kg" - when that's more than the total says.
    const typed = countedAsText(count.countedAs, offered, symbol)
    const counted = typed && (count.boxes.length > 1 || !count.boxes[0].unit.isStockUnit) ? typed : total
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
        payload: { countedQuantity: base, areaId, shortAs: shortChosen ?? undefined, countedAs: count.countedAs },
      })
      onCounted({
        productId: product.id,
        productName: product.name,
        summary: `${counted} · ${said}`,
        countedAs: count.countedAs,
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
    // A card in a narrow space; a line of the table where there's room (the Count stock page on a laptop): product,
    // what the app says, the boxes, and what it comes to with Save.
    <li
      className={`flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 @3xl:grid @3xl:grid-cols-[minmax(0,1.3fr)_8rem_minmax(0,1.6fr)_minmax(0,1.1fr)] @3xl:items-start @3xl:gap-4 ${
        card ? '' : '@3xl:rounded-none @3xl:border-0'
      }`}
      data-count-row={product.name}
    >
      <div className="flex items-baseline justify-between gap-2 @3xl:contents">
        <span className="min-w-0 flex-1 truncate text-base font-semibold text-neutral-900 @3xl:pt-2.5 @3xl:text-sm">{product.name}</span>
        <span className="shrink-0 text-sm text-neutral-500 tabular-nums @3xl:pt-2.5 @3xl:text-neutral-700" data-count-app-says>
          <span className="@3xl:hidden">App: </span>
          {formatNumber(appSays)} {stockUnitWord(symbol, appSays)}
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
      {(problem || typedAny || onCancel) && (
        <div className="flex items-center justify-between gap-2 text-sm @3xl:flex-col @3xl:items-end @3xl:pt-1.5 @3xl:text-right">
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
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-10 shrink-0 items-center rounded-md px-3 font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Cancel
            </button>
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
