import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, MoreHorizontal } from 'lucide-react'
import { useCatalogList } from '@/features/catalog/useCatalog'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { Product } from '@/features/products/types'
import type { UnitOption } from '@/features/products/types'
import { formatNumber, pluraliseUnitNoun, stockUnitWord, unitNoun } from '@/features/products/unitCopy'
import {
  countUnits,
  isCountedInWholeUnits,
  productsOwnUnits,
  resolveUnitSymbol,
  roundQuantity,
  toBaseQuantity,
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

/** A typed amount, or null while it isn't one yet ("", "."). */
function amountOf(text: string): number | null {
  const trimmed = text.trim()
  return /^\d+(\.\d{1,3})?$/.test(trimmed) || /^\.\d{1,3}$/.test(trimmed) ? Number(trimmed) : null
}

/**
 * One product counted on its row (owner, 2026-11-09): its name, then a box for each unit it's counted in - the pack
 * and what's left ("[2] bags + [7] dericas"), or one box - with what the app says shown faintly inside, never filled
 * in for them. Next on the phone's keypad goes to the second box, then records. The "⋯" says what a shortfall is
 * recorded as here and changes it for this count.
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
  const pair = countUnits(product, offered)
  const [extra, setExtra] = useState(false)
  const units: UnitOption[] = pair.big ? [pair.big, pair.small] : extra ? [pair.small, offered.find((o) => o.label !== pair.small.label) ?? pair.small] : [pair.small]
  const [texts, setTexts] = useState<string[]>(['', ''])
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [shortChosen, setShortChosen] = useState<ShortAs | null>(null)
  const savingRef = useRef(false)
  const symbol = resolveUnitSymbol(product.unitOfMeasure, options)
  const wholeOnly = isCountedInWholeUnits(product.unitOfMeasure, options)
  const area = (useOptionalWorkingBranch()?.branches ?? []).flatMap((b) => b.areas ?? []).find((a) => a.id === areaId)
  const shortAs = shortChosen ?? (area ? areaShortAs(area) : 'MISSING')
  const pending = usePendingStock(product.id, areaId)
  const appSays = roundQuantity((figureInArea(product, areaId) ?? product.quantityOnHand) + pending.delta)

  // What the app says, faintly in the boxes: whole packs, then the rest in the second unit.
  const hints: string[] = (() => {
    if (units.length === 1) return [formatNumber(roundQuantity(appSays / units[0].factorToStockUnit))]
    const packs = Math.floor(appSays / units[0].factorToStockUnit + 1e-9)
    const rest = roundQuantity((appSays - packs * units[0].factorToStockUnit) / units[1].factorToStockUnit)
    return [formatNumber(packs), formatNumber(rest)]
  })()

  const noun = (unit: UnitOption, amount: number) =>
    unit.isStockUnit ? stockUnitWord(symbol, amount) : pluraliseUnitNoun(unitNoun(unit), amount)

  async function record() {
    if (savingRef.current) return
    const amounts = units.map((_, index) => (texts[index].trim() === '' ? 0 : amountOf(texts[index])))
    if (texts.slice(0, units.length).every((text) => text.trim() === '')) return setProblem('Type how many are here.')
    if (amounts.some((amount) => amount == null)) return setProblem('A number, to 3 decimal places.')
    const base = roundQuantity(units.reduce((sum, unit, index) => sum + toBaseQuantity(amounts[index] ?? 0, unit), 0))
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

  // The difference, live, before it's recorded: "30 short · used in the Kitchen".
  const typedAny = texts.slice(0, units.length).some((text) => text.trim() !== '')
  const typedAmounts = units.map((_, index) => (texts[index].trim() === '' ? 0 : amountOf(texts[index])))
  const preview = typedAny && typedAmounts.every((amount) => amount != null)
    ? roundQuantity(units.reduce((sum, unit, index) => sum + toBaseQuantity(typedAmounts[index] ?? 0, unit), 0) - appSays)
    : null

  return (
    <li className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5" data-count-row={product.name}>
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 truncate pt-2.5 text-base font-semibold text-neutral-900">{product.name}</span>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {units.map((unit, index) => (
            <div key={`${unit.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && (
                <span aria-hidden="true" className="text-sm text-neutral-500">
                  +
                </span>
              )}
              <label htmlFor={boxId(product.id, index)} className="sr-only">
                {`${product.name}: ${noun(unit, 2)} here`}
              </label>
              <input
                id={boxId(product.id, index)}
                inputMode="decimal"
                enterKeyHint={index < units.length - 1 ? 'next' : 'done'}
                autoComplete="off"
                disabled={saving}
                value={texts[index]}
                placeholder={hints[index]}
                onChange={(event) => {
                  setProblem(null)
                  const next = [...texts]
                  next[index] = event.target.value.replace(',', '.')
                  setTexts(next)
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  if (index < units.length - 1) document.getElementById(boxId(product.id, index + 1))?.focus()
                  else void record()
                }}
                className="h-11 w-20 rounded-md border-2 border-neutral-200 px-2 text-right text-lg font-semibold tabular-nums placeholder:font-normal placeholder:text-neutral-400 focus:border-primary-600 focus:outline-none"
              />
              <span className="w-16 text-sm text-neutral-600">{noun(unit, amountOf(texts[index]) ?? 2)}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-label={`More for ${product.name}`}
          onClick={() => setMenuOpen((open) => !open)}
          className="-mr-2 inline-flex h-11 w-9 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {(problem || menuOpen || typedAny) && (
        <div className="mt-1 flex items-center justify-between gap-2 text-sm">
          {problem ? (
            <p role="alert" className="min-w-0 flex-1 text-danger-700">
              {problem}
            </p>
          ) : preview != null ? (
            <p className="min-w-0 flex-1 text-neutral-700" data-count-preview>
              {preview === 0
                ? 'Matches what the app says'
                : preview > 0
                  ? `${formatNumber(preview)} ${stockUnitWord(symbol, preview)} more than the app says`
                  : `${formatNumber(-preview)} ${stockUnitWord(symbol, -preview)} short · ${shortAs === 'USED' ? `used in the ${areaName}` : `missing from the ${areaName}`}`}
            </p>
          ) : (
            <span />
          )}
          <div className="flex shrink-0 flex-wrap items-center justify-end">
            {menuOpen && (
              <>
                {!pair.big && !extra && offered.length > 1 && (
                  <button type="button" onClick={() => setExtra(true)} className="min-h-10 px-2 font-medium text-primary-700">
                    Count in two units
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShortChosen(shortAs === 'USED' ? 'MISSING' : 'USED')}
                  className="min-h-10 px-2 font-medium text-primary-700"
                >
                  {shortAs === 'USED' ? 'Short is missing' : 'Short is used'}
                </button>
              </>
            )}
            {typedAny && (
              <button
                type="button"
                onClick={() => void record()}
                disabled={saving}
                className="min-h-10 rounded-md px-2 font-semibold text-primary-700 hover:bg-primary-50"
              >
                {saving ? 'Recording…' : 'Record'}
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}
