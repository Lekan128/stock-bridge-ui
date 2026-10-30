import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUpDown, Repeat, Search, X } from 'lucide-react'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { useApiQuery } from '@/data/useApiQuery'
import { hasAreas } from '@/features/branches/areas'
import { useWorkArea } from '@/features/branches/workArea'
import { SheetChoices } from '@/features/branches/SheetChoices'
import type { Area } from '@/features/branches/types'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { useProductFinder } from '@/features/catalog/useProductFinder'
import { DraftNote } from '@/features/drafts/DraftNote'
import { useDraft } from '@/features/drafts/useDraft'
import { movesApi } from '@/features/moves/movesApi'
import type { AreaMove } from '@/features/moves/types'
import { applyMoveResult, submitMove } from '@/features/outbox/outboxStore'
import { productsApi } from '@/features/products/api/productsApi'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { Product, UnitOption } from '@/features/products/types'
import { formatNumber, packRemainderPhrase, pluraliseUnitNoun, stockUnitWord, unitNoun } from '@/features/products/unitCopy'
import { packRemainder, resolveUnitSymbol, stockUnitOption, toBaseQuantity } from '@/features/products/unitSet'
import { unitsFor } from '@/features/selling/sale/saleLine'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAppError } from '@/types/api'

/** One product on the move being written. */
interface MoveLine {
  key: string
  product: Product
  /** The unit counted in, by its label - unique within a product's set. */
  unitLabel: string
  quantity: string
}

interface MoveDraft {
  fromAreaId: string
  toAreaId: string
  lines: MoveLine[]
  note: string
}

/** What happened once Move was pressed. */
type Done = { status: 'sent'; move: AreaMove } | { status: 'queued'; summary: string }

/** A new line opens in the product's pack (crates, bags) when it has one, as Send stock does. */
function openingOption(options: UnitOption[]): UnitOption {
  return options.find((option) => !option.isStockUnit) ?? stockUnitOption(options)
}

/** The product's figure in one area, when the product says. */
function figureIn(product: Product, areaId: string): number | undefined {
  if (product.areaStock == null) return undefined
  return product.areaStock.find((figure) => figure.areaId === areaId)?.quantityOnHand ?? 0
}

/**
 * Move stock (STOCK_AREAS_PLAN.md §5.1, STOCK_AREAS_PART_2.md): the areas of the branch at the top, as
 * chips with a swap; the routes this branch uses most, and "Repeat the last one"; a line per product with
 * both areas' figures, before → after; a button that names what it does. A page, like Send stock: a
 * document built item by item, with a draft kept on the phone. It goes through the outbox, so it works
 * offline. To an area that uses what it's given (Housekeeping) it is a give, recorded as Used there.
 *
 * Opened with `?product=` (the product page's Move), `?from=` and `?to=`.
 */
export function MoveStockPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { working, recordable } = useWorkingBranch()
  const { options: catalogue } = useUnitOfMeasureOptions()
  const online = useOnlineStatus()
  const branch = working && recordable.some((entry) => entry.id === working.id) ? working : null

  // From: the areas this person works in (Part 3) - they're taking stock out of it - starting where this
  // phone is for them; for people in every area, where deliveries arrive. To: any open area.
  const work = useWorkArea(branch)
  const fromChoices = work.areas
  const allOpen = (branch?.areas ?? []).filter((area) => area.active)
  const [fromChoice, setFromChoice] = useState<string | null>(() => searchParams.get('from'))
  const fromAreaId = fromChoices.some((area) => area.id === fromChoice)
    ? (fromChoice as string)
    : (work.area?.id ?? fromChoices.find((area) => area.delivery)?.id ?? fromChoices[0]?.id ?? '')
  const [toAreaId, setToAreaId] = useState<string>(() => searchParams.get('to') ?? '')
  const toChoices = allOpen.filter((area) => area.id !== fromAreaId)
  const from = allOpen.find((area) => area.id === fromAreaId)
  const to = toChoices.find((area) => area.id === toAreaId)
  const [lines, setLines] = useState<MoveLine[]>([])
  const [note, setNote] = useState('')
  const [term, setTerm] = useState('')
  const [moving, setMoving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)

  // ------------------------------------------------------------------- usual routes, and the last one
  const recent = useApiQuery({
    queryKey: ['area-moves', 'recent', branch?.id],
    queryFn: () => movesApi.list({ branchId: branch!.id, size: 30 }),
    fallbackError: "Couldn't load recent moves.",
    enabled: branch != null,
  })
  const routes = useMemo(() => {
    const seen = new Map<string, AreaMove>()
    for (const move of recent.data?.content ?? []) {
      if (move.status !== 'DONE') continue
      const key = `${move.fromAreaId}>${move.toAreaId}`
      if (!seen.has(key)) seen.set(key, move)
    }
    return [...seen.values()]
      .filter((move) => fromChoices.some((area) => area.id === move.fromAreaId) && allOpen.some((area) => area.id === move.toAreaId))
      .slice(0, 3)
  }, [recent.data, fromChoices, allOpen])
  const lastOnRoute = routes.find((move) => move.fromAreaId === fromAreaId && move.toAreaId === toAreaId)

  // ------------------------------------------------------------------------------ the draft (A5)
  const draft = useDraft<MoveDraft>(`move:${branch?.id ?? 'none'}`, branch != null)
  const [restored, setRestored] = useState(false)
  const { initial, save } = draft
  useEffect(() => {
    if (!initial) return
    const saved = initial.value
    setFromChoice(saved.fromAreaId)
    setToAreaId((current) => current || saved.toAreaId)
    setLines((current) => [...current, ...saved.lines.filter((line) => !current.some((c) => c.product.id === line.product.id))])
    setNote(saved.note)
    setRestored(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial])
  useEffect(() => {
    if (initial === undefined || lines.length === 0 || done) return
    save({ fromAreaId, toAreaId, lines, note })
  }, [fromAreaId, toAreaId, lines, note, initial, save, done])

  // ---------------------------------------------------------------------- pre-filled from a link
  // `?product=` from a product page, `?products=a,b` from the products selected on Inventory.
  const prefilled = useRef(false)
  const linkedIds = [searchParams.get('product'), ...(searchParams.get('products')?.split(',') ?? [])].filter(
    (id): id is string => !!id,
  )
  useEffect(() => {
    if (prefilled.current || catalogue.length === 0 || linkedIds.length === 0) return
    prefilled.current = true
    const one = linkedIds.length === 1
    for (const id of linkedIds) {
      void productsApi
        .get(id)
        .then((product) => addProduct(product, '', undefined, one))
        .catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue])

  // Opened from Inventory with nothing chosen, the screen is a list to build: on a laptop (where a
  // scanner types too) the search is ready. Not on a phone, where the keyboard would hide the routes.
  const searchRef = useRef<HTMLInputElement>(null)
  const searchReadied = useRef(false)
  useEffect(() => {
    if (searchReadied.current || !searchRef.current) return
    searchReadied.current = true
    if (linkedIds.length > 0 || !window.matchMedia?.('(pointer: fine)').matches) return
    searchRef.current.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch?.id])

  /** A new line goes at the top, just under the search, and its quantity is ready to type. */
  function addProduct(product: Product, quantity = '', unitLabel?: string, focus = true) {
    setTerm('')
    setProblem(null)
    setLines((current) => {
      if (current.some((line) => line.product.id === product.id)) return current
      const options = unitsFor(product, catalogue)
      const option = options.find((o) => o.label === unitLabel) ?? openingOption(options)
      return [{ key: product.id, product, unitLabel: option.label, quantity }, ...current]
    })
    if (focus) window.requestAnimationFrame(() => document.getElementById(`move-qty-${product.id}`)?.focus())
  }

  const finder = useProductFinder(term, (product) => addProduct(product))

  /** "Repeat the last one": the same items, in the same amounts, as the last move on this route. */
  function repeatLast(move: AreaMove) {
    for (const line of move.lines) {
      void productsApi
        .get(line.productId)
        .then((product) => {
          const options = unitsFor(product, catalogue)
          const typed = options.find((o) => o.code === line.enteredUnit && !o.isStockUnit)
          addProduct(product, String(typed && line.enteredQuantity != null ? line.enteredQuantity : line.quantity), typed?.label, false)
        })
        .catch(() => undefined)
    }
  }

  function update(key: string, patch: Partial<MoveLine>) {
    setProblem(null)
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  // ------------------------------------------------------------------------------------ checks
  const checked = lines.map((line) => {
    const options = unitsFor(line.product, catalogue)
    const option = options.find((o) => o.label === line.unitLabel) ?? stockUnitOption(options)
    const quantity = Number(line.quantity)
    const valid = line.quantity.trim() !== '' && Number.isInteger(quantity) && quantity > 0
    const base = valid ? toBaseQuantity(quantity, option) : 0
    const has = fromAreaId ? figureIn(line.product, fromAreaId) : undefined
    const toHas = to?.keepsStock ? figureIn(line.product, to.id) : undefined
    return { line, options, option, quantity, valid, base, has, toHas, short: has != null && base > has }
  })
  const ready = checked.filter((entry) => entry.valid)
  const anyShort = checked.some((entry) => entry.short)
  const anyInvalid = checked.some((entry) => entry.line.quantity.trim() !== '' && !entry.valid)
  const canMove = !moving && from != null && to != null && ready.length > 0 && !anyShort && !anyInvalid
  const items = `${ready.length} ${ready.length === 1 ? 'item' : 'items'}`
  const verb = to && !to.keepsStock ? 'Give' : 'Move'

  async function move() {
    if (!canMove || !branch || !to || !from) return
    setMoving(true)
    setProblem(null)
    const summary = `${items} · ${from.name} → ${to.name}`
    try {
      const outcome = await submitMove(
        {
          id: crypto.randomUUID(),
          branchId: branch.id,
          fromAreaId: from.id,
          toAreaId: to.id,
          note: note.trim() || undefined,
          lines: ready.map((entry) => ({
            productId: entry.line.product.id,
            quantity: entry.quantity,
            unit: entry.option.isStockUnit ? undefined : entry.option.code || undefined,
          })),
        },
        summary,
      )
      await draft.finish()
      setDone(outcome.status === 'sent' ? { status: 'sent', move: outcome.response } : { status: 'queued', summary })
    } catch (error) {
      setProblem(isAppError(error) ? error.message : "Couldn't move this. Try again.")
    } finally {
      setMoving(false)
    }
  }

  function moveMore() {
    setDone(null)
    setLines([])
    setNote('')
    setRestored(false)
  }

  if (!branch || !hasAreas(branch) || fromChoices.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Move stock</h1>
        <p className="text-sm text-neutral-700">
          {branch && work.limited
            ? `You don't work in an area of ${branch.name} that keeps stock, so there is nothing for you to move from here.`
            : branch
            ? `${branch.name} has one area, so there is nowhere to move stock to. Add areas in Company settings → Branches.`
            : 'Choose a branch at the top of the screen first: stock moves between the areas of one branch.'}
        </p>
      </div>
    )
  }

  if (done) {
    return <MoveDone done={done} onMoreMoves={moveMore} onDone={() => navigate(-1)} />
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5">
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="mt-1 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Move stock</h1>
            <p className="mt-1 text-sm text-neutral-600">at {branch.name}</p>
          </div>
        </div>

        <DraftNote
          savedAt={draft.savedAt}
          restored={restored}
          onDiscard={() => {
            void draft.clear()
            setRestored(false)
            setLines([])
            setNote('')
          }}
        />

        {routes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span id="usual-routes-label" className="text-sm text-neutral-700">
              Usual
            </span>
            <div role="group" aria-labelledby="usual-routes-label" className="flex flex-wrap gap-2">
              {routes.map((route) => (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => {
                    setFromChoice(route.fromAreaId)
                    setToAreaId(route.toAreaId)
                  }}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-800 hover:bg-neutral-50"
                >
                  {route.fromAreaName}
                  <ArrowRight className="h-3.5 w-3.5 text-neutral-500" aria-label="to" />
                  {route.toAreaName}
                </button>
              ))}
            </div>
          </div>
        )}

        <section aria-label="From and to" className="flex flex-col gap-3">
          {/* One row on a wider screen - From, swap, To - and stacked on a phone. */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start">
            <div className="col-span-2 sm:col-span-1">
              <AreaPicker
                label="From"
                areas={fromChoices}
                chosen={fromAreaId}
                onChoose={(id) => {
                  setFromChoice(id)
                  if (id === toAreaId) setToAreaId('')
                }}
              />
            </div>
            {/* Level with the choices, below their labels. */}
            <div className="order-last sm:order-none sm:mt-7">
              <Button
                variant="secondary"
                aria-label="Swap from and to"
                disabled={!to || !to.keepsStock}
                onClick={() => {
                  const was = fromAreaId
                  setFromChoice(toAreaId)
                  setToAreaId(was)
                }}
              >
                <ArrowUpDown className="h-4 w-4 sm:hidden" aria-hidden="true" />
                <ArrowLeftRight className="hidden h-4 w-4 sm:block" aria-hidden="true" />
              </Button>
            </div>
            <div className="min-w-0">
              <AreaPicker label="To" areas={toChoices} chosen={toAreaId} onChoose={setToAreaId} />
            </div>
          </div>
          {to && !to.keepsStock && (
            <p className="text-sm text-neutral-700">
              {to.name} uses what it's given: what you give it is recorded as used there.
            </p>
          )}
          {lastOnRoute && (
            <div>
              <Button variant="quiet" className="-ml-2" onClick={() => repeatLast(lastOnRoute)}>
                <Repeat className="h-4 w-4" aria-hidden="true" />
                Repeat the last one ({lastOnRoute.lines.length} {lastOnRoute.lines.length === 1 ? 'item' : 'items'},{' '}
                {new Date(lastOnRoute.movedAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })})
              </Button>
            </div>
          )}
        </section>

        <section aria-labelledby="move-lines-heading" className="flex flex-col gap-3">
          <h2 id="move-lines-heading" className="text-sm font-semibold text-neutral-900">
            What's moving
          </h2>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
            <label htmlFor="move-search" className="sr-only">
              Scan or search to add an item
            </label>
            <input
              ref={searchRef}
              id="move-search"
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              value={term}
              disabled={moving}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  finder.onEnter()
                }
              }}
              placeholder={lines.length === 0 ? 'Scan or search to add an item…' : 'Scan or search to add another item…'}
              className="h-12 w-full rounded-lg border-2 border-neutral-300 bg-white pr-3 pl-11 text-base text-neutral-900 placeholder:text-neutral-500 focus:border-primary-600 focus:outline-none"
            />
          </div>
          {finder.search && (
            <div className="flex flex-col gap-1">
              {finder.results.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-left hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <span className="truncate text-base font-medium text-neutral-900">{product.name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-neutral-500">{product.sku}</span>
                </button>
              ))}
              {finder.answered && finder.results.length === 0 && (
                <p className="px-1 text-sm text-neutral-600">Nothing matches “{finder.search}”.</p>
              )}
            </div>
          )}
          {checked.length > 0 && (
            <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white" aria-label="On this move">
              {checked.map(({ line, options, option, base, has, toHas, short }) => {
                const unit = resolveUnitSymbol(line.product.unitOfMeasure, catalogue)
                const inputId = `move-qty-${line.key}`
                return (
                  <li
                    key={line.key}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                    data-move-line={line.product.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium text-neutral-900">{line.product.name}</p>
                      {/* Both areas, before → after (§5.1), in the unit being moved and in the stock unit:
                          the storekeeper sees what's left behind, in packs and in all. */}
                      <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 text-sm tabular-nums" data-before-after>
                        {from && has != null && (
                          <>
                            <dt className="text-neutral-600">{from.name}</dt>
                            <dd className={short ? 'font-medium text-danger-700' : 'text-neutral-900'}>
                              <BeforeAfter before={has} after={short ? null : has - base} option={option} unit={unit} />
                            </dd>
                          </>
                        )}
                        {to && (
                          <>
                            <dt className="text-neutral-600">{to.name}</dt>
                            <dd className="text-neutral-900">
                              {to.keepsStock && toHas != null ? (
                                <BeforeAfter before={toHas} after={short ? null : toHas + base} option={option} unit={unit} />
                              ) : (
                                'used there'
                              )}
                            </dd>
                          </>
                        )}
                      </dl>
                      {short && has != null && from && (
                        <p className="mt-1 text-sm text-danger-700">
                          The {from.name} has {inUnit(has, option, unit)}.
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <label htmlFor={inputId} className="sr-only">
                        How many {line.product.name}
                      </label>
                      <input
                        id={inputId}
                        inputMode="numeric"
                        value={line.quantity}
                        disabled={moving}
                        aria-invalid={short || undefined}
                        onChange={(event) => update(line.key, { quantity: event.target.value.replace(/[^0-9]/g, '') })}
                        className={`h-11 w-20 rounded-md border bg-white px-3 text-base tabular-nums focus:ring-2 focus:outline-none ${
                          short ? 'border-danger-500 focus:ring-danger-100' : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-100'
                        }`}
                      />
                      {options.length > 1 ? (
                        <select
                          aria-label={`Unit for ${line.product.name}`}
                          value={option.label}
                          disabled={moving}
                          onChange={(event) => update(line.key, { unitLabel: event.target.value })}
                          className="h-11 rounded-md border border-neutral-300 bg-white px-2 text-base sm:text-sm"
                        >
                          {options.map((o) => (
                            <option key={o.label} value={o.label}>
                              {o.isStockUnit ? unit : unitNoun(o)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-neutral-600">{unit}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                        aria-label={`Take ${line.product.name} off`}
                        className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 sm:ml-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

        </section>

        <TextField id="move-note" label="Note (optional)" value={note} maxLength={1000} disabled={moving} onChange={(event) => setNote(event.target.value)} />

        {problem && (
          <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {problem}
          </p>
        )}
      </div>

      <div className="sticky -bottom-6 z-10 -mx-6 mt-6 -mb-6 border-t border-neutral-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          <Button variant="action" className="w-full" disabled={!canMove} loading={moving} onClick={() => void move()}>
            {ready.length === 0 ? 'Add something to move' : !to ? 'Choose where it goes' : `${verb} ${items} to ${to.name}`}
          </Button>
          {!online && ready.length > 0 && (
            <p className="text-center text-xs text-neutral-600">You're offline. It's kept on this phone and goes when you're connected.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * A figure in the unit being moved: "68 baskets", "68 baskets + 2 g" when a pack doesn't divide it, or
 * "340 g" in the stock unit.
 */
function inUnit(base: number, option: UnitOption, unit: string): string {
  if (option.isStockUnit) return `${formatNumber(base)} ${stockUnitWord(unit, base)}`
  const split = packRemainderPhrase(packRemainder(base, option), option, unit)
  return split ?? `0 ${pluraliseUnitNoun(unitNoun(option), 0)}`
}

/**
 * One area's figure, before → after the move: "340 → 325 g", or in a pack "68 → 65 baskets · 340 →
 * 325 g" - the packs left, and everything in the stock unit. Before a quantity is typed, just the figure.
 */
function BeforeAfter({ before, after, option, unit }: { before: number; after: number | null; option: UnitOption; unit: string }) {
  const changes = after != null && after !== before
  const stock = changes
    ? `${formatNumber(before)} → ${formatNumber(after)} ${stockUnitWord(unit, after)}`
    : `${formatNumber(before)} ${stockUnitWord(unit, before)}`
  if (option.isStockUnit) return <>{stock}</>
  const factor = option.factorToStockUnit
  const whole = (n: number) => factor > 0 && Number.isInteger(n / factor)
  // Whole packs either side read as one phrase, "68 → 65 baskets"; a part pack spells both out.
  const packs = !changes
    ? inUnit(before, option, unit)
    : whole(before) && whole(after)
      ? `${formatNumber(before / factor)} → ${formatNumber(after / factor)} ${pluraliseUnitNoun(unitNoun(option), after / factor)}`
      : `${inUnit(before, option, unit)} → ${inUnit(after, option, unit)}`
  return (
    <>
      {packs}
      <span className="text-neutral-600"> · {stock}</span>
    </>
  )
}

/** "From" or "To": the areas as chips (DESIGN.md's choice for a few options), a select past six. */
function AreaPicker({
  label,
  areas,
  chosen,
  onChoose,
}: {
  label: string
  areas: Area[]
  chosen: string
  onChoose: (id: string) => void
}) {
  const labelId = `move-${label.toLowerCase()}-label`
  // The chip says what an area that uses what it's given will do with it.
  const options = areas.map((area) => ({ ...area, name: area.keepsStock ? area.name : `${area.name} · uses it` }))
  return (
    <div>
      <p id={labelId} className="mb-1.5 text-sm font-medium text-neutral-800">
        {label}
      </p>
      {options.length <= 6 ? (
        <SheetChoices labelledBy={labelId} options={options} chosen={chosen || null} onChoose={onChoose} />
      ) : (
        <select
          aria-labelledby={labelId}
          value={chosen}
          onChange={(event) => onChoose(event.target.value)}
          className="min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Choose an area</option>
          {options.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

/** After Move: what was recorded, Undo for two minutes, and the way on. */
function MoveDone({ done, onMoreMoves, onDone }: { done: Done; onMoreMoves: () => void; onDone: () => void }) {
  const [move, setMove] = useState<AreaMove | null>(done.status === 'sent' ? done.move : null)
  const [undoing, setUndoing] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000)
    return () => window.clearInterval(timer)
  }, [])
  const mayUndo = move?.undoUntil != null && new Date(move.undoUntil).getTime() > now && move.status === 'DONE'

  async function undo() {
    if (!move) return
    setUndoing(true)
    setProblem(null)
    try {
      const undone = await movesApi.undo(move.id)
      applyMoveResult(undone)
      setMove(undone)
    } catch (error) {
      setProblem(isAppError(error) ? error.message : "Couldn't undo this. Try again.")
    } finally {
      setUndoing(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold text-neutral-900">
        {done.status === 'queued' ? 'Saved on this phone' : move?.status === 'VOIDED' ? 'Undone' : move?.toKeepsStock ? 'Moved' : 'Given'}
      </h1>
      {done.status === 'queued' ? (
        <p className="text-sm text-neutral-700">{done.summary}. It goes when you're connected.</p>
      ) : (
        move && (
          <div className="flex flex-col gap-2 border-y border-neutral-200 py-3" data-move-receipt={move.status}>
            <p className="text-sm text-neutral-700">
              {move.status === 'VOIDED' ? 'Put back where it came from. ' : ''}
              {move.fromAreaName} → {move.toAreaName}
              {!move.toKeepsStock && ' (used there)'} · by {move.movedByName ?? 'you'},{' '}
              {new Date(move.movedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </p>
            <ul className="text-sm text-neutral-900">
              {move.lines.map((line) => (
                <li key={line.productId} className="flex justify-between gap-3 py-0.5">
                  <span className="truncate">{line.productName}</span>
                  <span className="shrink-0 tabular-nums">
                    {line.enteredQuantity != null && line.enteredUnit ? `${formatNumber(line.enteredQuantity)} ${line.enteredUnit.toLowerCase()}` : formatNumber(line.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
      {problem && (
        <p role="alert" className="text-sm text-danger-700">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {mayUndo && (
          <Button variant="secondary" loading={undoing} onClick={() => void undo()}>
            Undo
          </Button>
        )}
        <Button variant="secondary" onClick={onMoreMoves}>
          Move more
        </Button>
        <Button variant="action" onClick={onDone}>
          Done
        </Button>
      </div>
      <Link to="/app/stock-movements?moves=1" className="self-start text-sm font-medium text-primary-700 hover:underline">
        See all moves
      </Link>
    </div>
  )
}
