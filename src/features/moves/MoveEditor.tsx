import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeftRight, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { useApiQuery } from '@/data/useApiQuery'
import { hasAreas } from '@/features/branches/areas'
import { useWorkArea } from '@/features/branches/workArea'
import type { Area } from '@/features/branches/types'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { useProductFinder } from '@/features/catalog/useProductFinder'
import { DraftNote } from '@/features/drafts/DraftNote'
import { useDraft } from '@/features/drafts/useDraft'
import { movesApi } from '@/features/moves/movesApi'
import type { AreaMove } from '@/features/moves/types'
import { submitMove } from '@/features/outbox/outboxStore'
import { productsApi } from '@/features/products/api/productsApi'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { Product, UnitOption } from '@/features/products/types'
import { formatNumber, packRemainderPhrase, pluraliseUnitNoun, stockUnitWord, unitNoun } from '@/features/products/unitCopy'
import { packRemainder, resolveUnitSymbol, stockUnitOption, toBaseQuantity } from '@/features/products/unitSet'
import { unitsFor } from '@/features/selling/sale/saleLine'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAppError } from '@/types/api'

/** How many usual items show before "+ N more". */
const USUAL_AT_FIRST = 6

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

/** What happened once Move was pressed: sent (Undo through the move), or saved on this phone (Undo drops it). */
export type Moved = ({ status: 'sent'; move: AreaMove } | { status: 'queued'; opId: string }) & {
  /** "Moved" or "Given" (to an area that uses what it's given). */
  verb: string
  /** "2 items". */
  items: string
  /** "Store → Kitchen". */
  route: string
}

export interface MoveEditorProps {
  /** Products to start with: the product page's Move, or the products selected on Inventory. */
  productIds?: string[]
  /** Focus the search when it opens (a laptop, where a scanner types too); never on a phone. */
  focusSearch?: boolean
  onMoved: (moved: Moved) => void
  /** Where the editor goes: its body, and the Move button for a footer. */
  children: (parts: { body: ReactNode; action: ReactNode }) => ReactNode
}

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
 * Move stock (STOCK_AREAS_PLAN.md §5.1, STOCK_AREAS_PART_2/3.md), as one piece the app places where the
 * other stock actions are: a tab of quick mode, and a Sheet from Inventory and the product page - never a
 * screen of its own (owner, 2026-10-30). The route on one row (From ⇄ To, opening on the last route used);
 * the search; with nothing added, last time's items on this route one tap away; one row per item with both
 * areas' figures before → after beneath. The place shows the result as it shows every write (the stamp,
 * the toast) with Undo. It goes through the outbox, so it works offline. To an area that uses what it's
 * given (Housekeeping) it is a give, recorded as Used there.
 */
export function MoveEditor({ productIds = [], focusSearch = false, onMoved, children }: MoveEditorProps) {
  const { working, recordable } = useWorkingBranch()
  const { options: catalogue } = useUnitOfMeasureOptions()
  const online = useOnlineStatus()
  const branch = working && recordable.some((entry) => entry.id === working.id) ? working : null

  // From: the areas this person works in (Part 3) - they're taking stock out of it - starting where this
  // phone is for them; for people in every area, where deliveries arrive. To: any open area.
  const work = useWorkArea(branch)
  const fromChoices = work.areas
  const allOpen = (branch?.areas ?? []).filter((area) => area.active)
  const [fromChoice, setFromChoice] = useState<string | null>(null)
  const fromAreaId = fromChoices.some((area) => area.id === fromChoice)
    ? (fromChoice as string)
    : (work.area?.id ?? fromChoices.find((area) => area.delivery)?.id ?? fromChoices[0]?.id ?? '')
  const [toAreaId, setToAreaId] = useState<string>('')
  const toChoices = allOpen.filter((area) => area.id !== fromAreaId)
  const from = allOpen.find((area) => area.id === fromAreaId)
  const to = toChoices.find((area) => area.id === toAreaId)
  const [lines, setLines] = useState<MoveLine[]>([])
  const [note, setNote] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [moving, setMoving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // ------------------------------------------------------------------- usual routes, and the last one
  const recent = useApiQuery({
    queryKey: ['area-moves', 'recent', branch?.id],
    queryFn: () => movesApi.list({ branchId: branch!.id, size: 50 }),
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
    return [...seen.values()].filter(
      (move) => fromChoices.some((area) => area.id === move.fromAreaId) && allOpen.some((area) => area.id === move.toAreaId),
    )
  }, [recent.data, fromChoices, allOpen])

  /**
   * What usually goes on this route (owner, 2026-10-30): across its recent moves, the items that come up
   * again and again, most often first, each at the amount it went at last time. A route used fewer than
   * three times has no "usual" yet, so it offers last time's items instead.
   */
  const usual = useMemo(() => {
    const onRoute = (recent.data?.content ?? []).filter(
      (move) => move.status === 'DONE' && move.fromAreaId === fromAreaId && move.toAreaId === toAreaId,
    )
    if (onRoute.length === 0) return null
    const lastTime = {
      label: `Last time, ${new Date(onRoute[0].movedAt).toLocaleDateString(undefined, { weekday: 'short' })}`,
      items: onRoute[0].lines.map((line) => ({ line, times: 1 })),
    }
    if (onRoute.length < 3) return lastTime
    // Newest first, so the first time an item is seen is the amount it went at last.
    const byProduct = new Map<string, { line: AreaMove['lines'][number]; times: number }>()
    for (const move of onRoute) {
      for (const line of move.lines) {
        const seen = byProduct.get(line.productId)
        if (seen) seen.times += 1
        else byProduct.set(line.productId, { line, times: 1 })
      }
    }
    const items = [...byProduct.values()].filter((item) => item.times >= 2).sort((a, b) => b.times - a.times)
    const toName = allOpen.find((area) => area.id === toAreaId)?.name ?? ''
    return items.length > 0 ? { label: `Usual to ${toName}`, items } : lastTime
  }, [recent.data, fromAreaId, toAreaId, allOpen])
  const [allUsualShown, setAllUsualShown] = useState(false)
  // Opened with nothing chosen, the route is the last one used from here - most days the same as yesterday.
  const routed = useRef(false)
  useEffect(() => {
    if (routed.current || recent.data == null) return
    routed.current = true
    if (toAreaId) return
    const last = routes[0]
    if (!last) return
    setFromChoice(last.fromAreaId)
    setToAreaId(last.toAreaId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recent.data])

  // ------------------------------------------------------------------------------ the draft (A5)
  const draft = useDraft<MoveDraft>(`move:${branch?.id ?? 'none'}`, branch != null)
  // Once moved, nothing more is saved as a draft: the place clears or closes the editor.
  const finished = useRef(false)
  const [restored, setRestored] = useState(false)
  const { initial, save } = draft
  useEffect(() => {
    if (!initial) return
    const saved = initial.value
    setFromChoice(saved.fromAreaId)
    // Unfinished work wins over the last route; a link that named where it goes wins over both.
    setToAreaId((current) => saved.toAreaId || current)
    setLines((current) => [...current, ...saved.lines.filter((line) => !current.some((c) => c.product.id === line.product.id))])
    setNote(saved.note)
    setRestored(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial])
  // A draft only once something's been typed: a product opened from its page with no amount yet is not work
  // to pick up later. Everything cleared again: no draft left either.
  const hadWork = useRef(false)
  useEffect(() => {
    if (initial === undefined || finished.current) return
    const work = lines.some((line) => line.quantity.trim() !== '') || note.trim() !== ''
    if (!work) {
      if (hadWork.current) void draft.clear()
      hadWork.current = false
      return
    }
    hadWork.current = true
    save({ fromAreaId, toAreaId, lines, note })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromAreaId, toAreaId, lines, note, initial, save])

  // ---------------------------------------------------------------------- pre-filled from a link
  // The product page's product, or the products selected on Inventory.
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || catalogue.length === 0 || productIds.length === 0) return
    prefilled.current = true
    const one = productIds.length === 1
    for (const id of productIds) {
      void productsApi
        .get(id)
        .then((product) => addProduct(product, '', undefined, one))
        .catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue])

  // Opened with nothing chosen, it's a list to build: on a laptop (where a scanner types too) the search is
  // ready. Not on a phone, where the keyboard would cover the route and last time's items.
  const searchRef = useRef<HTMLInputElement>(null)
  const searchReadied = useRef(false)
  useEffect(() => {
    if (searchReadied.current || !searchRef.current) return
    searchReadied.current = true
    if (!focusSearch || productIds.length > 0 || !window.matchMedia?.('(pointer: fine)').matches) return
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

  /** A usual item (or all of them): the product, at the amount it went at last time on this route. */
  function addUsual(usualLines: AreaMove['lines']) {
    for (const line of usualLines) {
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
      finished.current = true
      await draft.finish()
      const said = { verb: verb === 'Give' ? 'Given' : 'Moved', items, route: `${from.name} → ${to.name}` }
      onMoved(outcome.status === 'sent' ? { status: 'sent', move: outcome.response, ...said } : { status: 'queued', opId: outcome.op.id, ...said })
    } catch (error) {
      setProblem(isAppError(error) ? error.message : "Couldn't move this. Try again.")
    } finally {
      setMoving(false)
    }
  }

  if (!branch || !hasAreas(branch) || fromChoices.length === 0) {
    return children({
      action: null,
      body: (
        <p className="text-sm text-neutral-700">
          {branch && work.limited
            ? `You don't work in an area of ${branch.name} that keeps stock, so there is nothing for you to move from here.`
            : branch
            ? `${branch.name} has one area, so there is nowhere to move stock to. Add areas in Company settings → Branches.`
            : 'Choose a branch at the top of the screen first: stock moves between the areas of one branch.'}
        </p>
      ),
    })
  }

  // The usual items not on this move yet; six at first, so a phone keeps room for the list being built.
  const usualLeft = (usual?.items ?? []).filter((item) => !lines.some((line) => line.product.id === item.line.productId))
  const usualShown = allUsualShown ? usualLeft : usualLeft.slice(0, USUAL_AT_FIRST)
  const body = (
      <div className="flex flex-col gap-3">
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

        {/* The route, one row: From ⇄ To. It opens on the last route used, so most days it isn't touched;
            the phone's own picker changes it. */}
        <section aria-label="From and to" className="rounded-lg border border-neutral-200 bg-white p-2" data-route>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-1.5">
            <RouteEnd
              label="From"
              areas={fromChoices}
              chosen={fromAreaId}
              onChoose={(id) => {
                setFromChoice(id)
                if (id === toAreaId) setToAreaId('')
              }}
            />
            <button
              type="button"
              aria-label="Swap from and to"
              disabled={!to || !to.keepsStock || !fromChoices.some((area) => area.id === to.id)}
              onClick={() => {
                const was = fromAreaId
                setFromChoice(toAreaId)
                setToAreaId(was)
              }}
              className="inline-flex h-11 w-10 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 disabled:text-neutral-300"
            >
              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <RouteEnd label="To" areas={toChoices} chosen={toAreaId} onChoose={setToAreaId} />
          </div>
          {to && !to.keepsStock && (
            <p className="px-1 pt-1.5 text-xs text-neutral-600">{to.name} uses what it's given: it's recorded as used there.</p>
          )}
        </section>

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
            placeholder={lines.length === 0 ? 'Scan or search an item' : 'Add another item'}
            className="h-12 w-full rounded-lg border border-neutral-300 bg-white pr-3 pl-11 text-base text-neutral-900 placeholder:text-neutral-500 focus:border-primary-600 focus:ring-2 focus:ring-primary-100 focus:outline-none"
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

        {/* What usually goes this way: tap one to add it, or Add all. Gone once everything's on the move. */}
        {usualLeft.length > 0 && !finder.search && usual && (
          <section aria-label={usual.label} className="flex flex-col gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-2" data-usual>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-neutral-600">{usual.label}</p>
              <button
                type="button"
                onClick={() => addUsual(usualLeft.map((item) => item.line))}
                className="-my-1.5 inline-flex min-h-11 shrink-0 items-center px-1 text-sm font-medium text-primary-700 hover:underline"
              >
                Add all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {usualShown.map((item) => (
                <button
                  key={item.line.productId}
                  type="button"
                  onClick={() => addUsual([item.line])}
                  aria-label={`Add ${item.line.productName}, ${typedAs(item.line)}`}
                  className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 text-sm text-neutral-800 hover:bg-neutral-50"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden="true" />
                  <span className="truncate">{item.line.productName}</span>
                  <span className="shrink-0 tabular-nums text-neutral-600">· {typedAs(item.line)}</span>
                </button>
              ))}
              {usualLeft.length > usualShown.length && (
                <button
                  type="button"
                  onClick={() => setAllUsualShown(true)}
                  className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-primary-700 hover:underline"
                >
                  + {usualLeft.length - usualShown.length} more
                </button>
              )}
            </div>
          </section>
        )}

        {checked.length > 0 && (
          <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white" aria-label="On this move">
            {checked.map(({ line, options, option, base, has, toHas, short }) => {
              const unit = resolveUnitSymbol(line.product.unitOfMeasure, catalogue)
              const inputId = `move-qty-${line.key}`
              return (
                <li key={line.key} className="flex flex-col gap-1 px-3 py-2.5" data-move-line={line.product.id}>
                  {/* One row: what, how many, in what; the figures under it, small. */}
                  <div className="flex items-center gap-2">
                    <p className="line-clamp-2 min-w-0 flex-1 text-base font-medium leading-snug text-neutral-900">{line.product.name}</p>
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
                      className={`h-11 w-16 shrink-0 rounded-md border bg-white px-2 text-center text-base tabular-nums focus:ring-2 focus:outline-none ${
                        short ? 'border-danger-500 focus:ring-danger-100' : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-100'
                      }`}
                    />
                    {options.length > 1 ? (
                      <select
                        aria-label={`Unit for ${line.product.name}`}
                        value={option.label}
                        disabled={moving}
                        onChange={(event) => update(line.key, { unitLabel: event.target.value })}
                        className="h-11 max-w-[6.5rem] shrink-0 rounded-md border border-neutral-300 bg-white px-1.5 text-base sm:text-sm"
                      >
                        {options.map((o) => (
                          <option key={o.label} value={o.label}>
                            {o.isStockUnit ? unit : unitNoun(o)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="shrink-0 text-sm text-neutral-600">{stockUnitWord(unit, Number(line.quantity) || 2)}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                      aria-label={`Take ${line.product.name} off`}
                      className="-mr-2 inline-flex h-11 w-9 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {/* Both areas, before → after (§5.1), in the unit being moved and in the stock unit. */}
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 text-xs tabular-nums" data-before-after>
                    {from && has != null && (
                      <>
                        <dt className="text-neutral-600">{from.name}</dt>
                        <dd className={short ? 'font-medium text-danger-700' : 'text-neutral-800'}>
                          <BeforeAfter before={has} after={short ? null : has - base} option={option} unit={unit} />
                        </dd>
                      </>
                    )}
                    {to && (
                      <>
                        <dt className="text-neutral-600">{to.name}</dt>
                        <dd className="text-neutral-800">
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
                    <p className="text-sm text-danger-700">
                      The {from.name} has {inUnit(has, option, unit)}.
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {/* A note is rare: a link until it's wanted. */}
        {noteOpen || note ? (
          <TextField id="move-note" label="Note" value={note} maxLength={1000} disabled={moving} onChange={(event) => setNote(event.target.value)} />
        ) : (
          lines.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setNoteOpen(true)
                window.requestAnimationFrame(() => document.getElementById('move-note')?.focus())
              }}
              className="-my-1 inline-flex min-h-11 items-center self-start text-sm font-medium text-primary-700 hover:underline"
            >
              Add a note
            </button>
          )
        )}

        {problem && (
          <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {problem}
          </p>
        )}
      </div>
  )
  const action = (
    <div className="flex w-full flex-col gap-2">
      <Button variant="action" className="w-full" disabled={!canMove} loading={moving} onClick={() => void move()}>
        {!to ? 'Choose where it goes' : ready.length === 0 ? `${verb} to ${to.name}` : `${verb} ${items} to ${to.name}`}
      </Button>
      {!online && ready.length > 0 && (
        <p className="text-center text-xs text-neutral-600">You're offline. It's kept on this phone and goes when you're connected.</p>
      )}
    </div>
  )
  return children({ body, action })
}

/** How a move's line was typed: "2 bags", or the stock-unit figure. */
function typedAs(line: AreaMove['lines'][number]): string {
  return line.enteredQuantity != null && line.enteredUnit
    ? `${formatNumber(line.enteredQuantity)} ${pluraliseUnitNoun(line.enteredUnit.toLowerCase(), line.enteredQuantity)}`
    : formatNumber(line.quantity)
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

/**
 * One end of the route, "From" or "To": the phone's own picker, which is the quickest on a phone and the
 * smallest on the page. With one choice (the cook's Kitchen) it's just the name.
 */
function RouteEnd({
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
  const id = `move-${label.toLowerCase()}`
  const name = (area: Area) => (area.keepsStock ? area.name : `${area.name} (uses it)`)
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block px-1 text-xs text-neutral-600">
        {label}
      </label>
      {areas.length === 1 && chosen === areas[0].id ? (
        <output id={id} className="flex h-11 items-center truncate px-1 text-base font-medium text-neutral-900">
          {name(areas[0])}
        </output>
      ) : (
        <select
          id={id}
          value={chosen}
          onChange={(event) => onChoose(event.target.value)}
          className={`h-11 w-full min-w-0 rounded-md border border-neutral-300 bg-white px-2 text-base font-medium ${chosen ? 'text-neutral-900' : 'text-neutral-500'}`}
        >
          {!chosen && <option value="">Choose…</option>}
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {name(area)}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
