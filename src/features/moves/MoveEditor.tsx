import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeftRight, ChevronDown, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { useApiQuery } from '@/data/useApiQuery'
import { hasAreas, stockAreas } from '@/features/branches/areas'
import { useWorkArea } from '@/features/branches/workArea'
import type { Area } from '@/features/branches/types'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { useProductFinder } from '@/features/catalog/useProductFinder'
import { DraftNote } from '@/features/drafts/DraftNote'
import { useDraft } from '@/features/drafts/useDraft'
import { movesApi } from '@/features/moves/movesApi'
import type { AreaMove } from '@/features/moves/types'
import { submitMove, submitRequest } from '@/features/outbox/outboxStore'
import { requestsApi } from '@/features/requests/requestsApi'
import type { StockRequest } from '@/features/requests/types'
import type { AskShare } from '@/features/requests/whatsAppShare'
import { productsApi } from '@/features/products/api/productsApi'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { Product, UnitOption } from '@/features/products/types'
import { formatNumber, formatQuantityInUnit, packRemainderPhrase, pluraliseUnitNoun, stockUnitWord, unitNoun } from '@/features/products/unitCopy'
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

/**
 * What happened once Move was pressed: sent (Undo through the move), or saved on this phone (Undo drops it); or,
 * asking (Part 5), the request sent or saved; or, filling one, only "none in the store" said.
 */
export type Moved = (
  | { status: 'sent'; move: AreaMove }
  | { status: 'queued'; opId: string }
  | { status: 'asked'; requestId: string; opId?: string; share: AskShare }
  | { status: 'answered' }
) & {
  /** "Moved" or "Given" (to an area that uses what it's given). */
  verb: string
  /** "2 items". */
  items: string
  /** "Store → Kitchen". */
  route: string
  /** The area it waits for, when that area confirms what arrives (Part 4): "waiting for the Kitchen". */
  waitingFor?: string
}

export interface MoveEditorProps {
  /** Products to start with: the product page's Move, or the products selected on Inventory. */
  productIds?: string[]
  /** Focus the search when it opens (a laptop, where a scanner types too); never on a phone. */
  focusSearch?: boolean
  onMoved: (moved: Moved) => void
  /** Where the editor goes: its body, the button for a footer, and whether it's asking now (the title says so). */
  children: (parts: { body: ReactNode; action: ReactNode; asking: boolean }) => ReactNode
  /** A request to fill (Part 5): the route and its lines filled in, with "None in the store" for each. */
  request?: StockRequest
  /**
   * Move (I carry it, from an area I work in) or Ask (Part 5: another area's people carry it, from any area that
   * keeps stock to one I work in). A quiet link in the route switches between them.
   */
  intent?: 'move' | 'ask'
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
export function MoveEditor({ productIds = [], focusSearch = false, onMoved, children, request, intent = 'move' }: MoveEditorProps) {
  const { working, recordable } = useWorkingBranch()
  const { options: catalogue } = useUnitOfMeasureOptions()
  const online = useOnlineStatus()
  const branch = working && recordable.some((entry) => entry.id === working.id) ? working : null

  // Moving: from the areas this person works in (Part 3) - they're taking stock out of it - starting where this
  // phone is for them; for people in every area, where deliveries arrive. To: any open area.
  // Asking (Part 5): from any area that keeps stock - where deliveries arrive, to start with - for an area they
  // work in, the one they're in to start with (owner, 2026-11-01: "ask from anywhere to where you have access").
  const work = useWorkArea(branch)
  const allOpen = (branch?.areas ?? []).filter((area) => area.active)
  const [asking, setAsking] = useState(intent === 'ask' && !request)
  // Filling a request (Part 5): its route, as asked.
  const requestFrom = request ? allOpen.find((area) => area.id === request.fromAreaId) : undefined
  const requestTo = request ? allOpen.find((area) => area.id === request.toAreaId) : undefined
  const askTo = work.area ?? work.areas.find((area) => !area.delivery) ?? work.areas[0]
  const fromChoices = request
    ? requestFrom
      ? [requestFrom]
      : []
    : asking
      ? stockAreas(branch)
      : work.areas
  const [fromChoice, setFromChoice] = useState<string | null>(null)
  const fromAreaId = request
    ? request.fromAreaId
    : fromChoices.some((area) => area.id === fromChoice)
      ? (fromChoice as string)
      : asking
        ? (fromChoices.find((area) => area.delivery && area.id !== askTo?.id) ?? fromChoices.find((area) => area.id !== askTo?.id))?.id ?? ''
        : (work.area?.id ?? fromChoices.find((area) => area.delivery)?.id ?? fromChoices[0]?.id ?? '')
  const [toAreaChoice, setToAreaId] = useState<string>('')
  const toChoices = request
    ? requestTo
      ? [requestTo]
      : []
    : (asking ? work.areas : allOpen).filter((area) => area.id !== fromAreaId)
  const toAreaId = request
    ? request.toAreaId
    : toChoices.some((area) => area.id === toAreaChoice)
      ? toAreaChoice
      : asking
        ? ((toChoices.find((area) => area.id === askTo?.id) ?? toChoices[0])?.id ?? '')
        : ''
  const from = allOpen.find((area) => area.id === fromAreaId)
  const to = toChoices.find((area) => area.id === toAreaId)
  // Lines the area asked has none of (filling a request): off the move, said on the request.
  const [noneHere, setNoneHere] = useState<string[]>([])
  const [lines, setLines] = useState<MoveLine[]>([])
  const [note, setNote] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [moving, setMoving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  /** Where a route from `fromId` may go: for asking, an area this person works in; for moving, any open area. */
  function toChoicesFor(fromId: string) {
    return (asking ? work.areas : allOpen).filter((area) => area.id !== fromId)
  }

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
      (move) => fromChoices.some((area) => area.id === move.fromAreaId) && toChoicesFor(move.fromAreaId).some((area) => area.id === move.toAreaId),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [usualOpen, setUsualOpen] = useState(true)
  // Opened with nothing chosen, the route is the last one used from here - most days the same as yesterday.
  const routed = useRef(false)
  useEffect(() => {
    if (routed.current || recent.data == null) return
    routed.current = true
    if (toAreaId || request) return
    const last = routes[0]
    if (!last) return
    setFromChoice(last.fromAreaId)
    setToAreaId(last.toAreaId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recent.data])

  // ------------------------------------------------------------------------------ the draft (A5)
  // Filling a request keeps no draft: the request itself is what's left to do. Asking keeps its own.
  const draft = useDraft<MoveDraft>(`${intent}:${branch?.id ?? 'none'}`, branch != null && !request)
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

  // ------------------------------------------------------------------ pre-filled from a request (Part 5)
  // What's still asked of each line, in the pack it was asked in when that's whole.
  const requestFilled = useRef(false)
  useEffect(() => {
    if (requestFilled.current || !request || catalogue.length === 0) return
    requestFilled.current = true
    for (const line of request.lines) {
      const left = line.quantity - line.moved
      if (left <= 0 || line.noneInStore) continue
      void productsApi
        .get(line.productId)
        .then((product) => {
          const options = unitsFor(product, catalogue)
          const typed = options.find((o) => o.code === line.enteredUnit && !o.isStockUnit)
          const per = typed ? toBaseQuantity(1, typed) : 1
          const inPacks = typed != null && per > 0 && left % per === 0
          addProduct(
            product,
            String(inPacks ? left / per : left),
            inPacks ? typed.label : stockUnitOption(options).label,
            false,
          )
        })
        .catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue])

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
    if (!focusSearch || productIds.length > 0 || request || !window.matchMedia?.('(pointer: fine)').matches) return
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
  // Searching means they know what they want: the usual items fold away (not on focus - a laptop focuses
  // the search as the panel opens).
  useEffect(() => {
    if (term.trim() !== '') setUsualOpen(false)
  }, [term])

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
  // Asking for more than the Store has is fine: the Store answers (Part 5).
  const canMove = !moving && from != null && to != null && ready.length > 0 && (asking || !anyShort) && !anyInvalid
  const items = `${ready.length} ${ready.length === 1 ? 'item' : 'items'}`
  const verb = to && !to.keepsStock ? 'Give' : 'Move'
  // Filling a request with nothing left to move: the button only says there's none.
  const onlyNone = request != null && ready.length === 0 && noneHere.length > 0

  /** Asking another area (Part 5): a request, through the outbox like a move. */
  async function ask() {
    if (!branch || !to || !from || ready.length === 0) return
    setMoving(true)
    setProblem(null)
    const requestId = crypto.randomUUID()
    try {
      const outcome = await submitRequest(
        {
          id: requestId,
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
        `${items} · asked of the ${from.name}`,
      )
      finished.current = true
      await draft.finish()
      // The WhatsApp message (owner, 2026-11-01), written here so it's there offline too.
      const asked = ready.map((entry) => `${entry.line.product.name} ${formatQuantityInUnit(entry.quantity, entry.option)}`)
      const share: AskShare = {
        text: `The ${to.name} asked for ${asked.join(', ')}. Open Procure Paddy to move ${
          asked.length === 1 ? 'it' : 'them'
        }: ${window.location.origin}/app?request=${requestId}`,
        movers: outcome.status === 'sent' ? (outcome.response.movers ?? []) : [],
      }
      onMoved({
        status: 'asked',
        requestId,
        share,
        ...(outcome.status === 'queued' ? { opId: outcome.op.id } : {}),
        verb: 'Asked',
        items,
        route: `${from.name} → ${to.name}`,
      })
    } catch (error) {
      setProblem(isAppError(error) ? error.message : "Couldn't ask for this. Try again.")
    } finally {
      setMoving(false)
    }
  }

  /** "None in the store" for the lines taken off (Part 5). Online only: it's an answer the Kitchen waits on. */
  async function sayNone(): Promise<boolean> {
    if (!request || noneHere.length === 0) return true
    try {
      await requestsApi.noneInStore(request.id, noneHere)
      return true
    } catch (error) {
      setProblem(
        isAppError(error) && error.status !== 0
          ? error.message
          : "You're offline. Saying there's none in the store needs a connection - try again when you're back.",
      )
      return false
    }
  }

  async function answerNone() {
    setMoving(true)
    setProblem(null)
    const said = await sayNone()
    setMoving(false)
    if (said && to && from) onMoved({ status: 'answered', verb: 'Told', items: `the ${to.name}`, route: `${from.name} → ${to.name}` })
  }

  async function move() {
    if (!canMove || !branch || !to || !from) return
    setMoving(true)
    setProblem(null)
    const summary = `${items} · ${from.name} → ${to.name}`
    if (!(await sayNone())) {
      setMoving(false)
      return
    }
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
          ...(request ? { requestId: request.id } : {}),
        },
        summary,
      )
      finished.current = true
      await draft.finish()
      const said = {
        verb: verb === 'Give' ? 'Given' : 'Moved',
        items,
        route: `${from.name} → ${to.name}`,
        ...(to.confirms ? { waitingFor: to.name } : {}),
      }
      onMoved(outcome.status === 'sent' ? { status: 'sent', move: outcome.response, ...said } : { status: 'queued', opId: outcome.op.id, ...said })
    } catch (error) {
      setProblem(isAppError(error) ? error.message : "Couldn't move this. Try again.")
    } finally {
      setMoving(false)
    }
  }

  if (!branch || !hasAreas(branch) || fromChoices.length === 0) {
    return children({
      asking,
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
        {/* Filling a request (Part 5): whose it is, above what they asked for. */}
        {request && (
          <p className="text-sm text-neutral-700" data-request-header>
            The {request.toAreaName} asked for these
            {request.askedByName ? ` · ${request.askedByName}` : ''}, {formatAskedAt(request.askedAt)}
          </p>
        )}
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
                setToAreaId('')
              }}
            />
            <button
              type="button"
              aria-label="Swap from and to"
              disabled={asking || request != null || !to || !to.keepsStock || !fromChoices.some((area) => area.id === to.id)}
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
          {asking && from ? (
            // Part 5: the people of the area asked move it.
            <p className="px-1 pt-1.5 text-xs text-neutral-600" data-asking>
              The {from.name}'s people move it to you.
            </p>
          ) : (
            to &&
            !to.keepsStock && (
              <p className="px-1 pt-1.5 text-xs text-neutral-600">{to.name} uses what it's given: it's recorded as used there.</p>
            )
          )}
          {/* The other way to get it there, quietly: carry it yourself, or have them bring it. */}
          {!request && (asking ? work.areas.some((area) => area.id === fromAreaId) : stockAreas(branch).length > 1) && (
            <button
              type="button"
              disabled={moving}
              onClick={() => {
                setAsking((was) => !was)
                setFromChoice(null)
                setToAreaId('')
              }}
              className="-mb-1 inline-flex min-h-11 items-center px-1 text-sm font-medium text-primary-700 hover:underline"
              data-switch-intent
            >
              {asking ? 'Move it yourself instead' : 'Ask for it instead'}
            </button>
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

        {/* What usually goes this way: tap one to add it, or Add all. Typing a search folds it into its one-line
            header (animated, so it's clear where it went); the header opens it again. Gone once all is on. */}
        {!request && usualLeft.length > 0 && usual && (
          <section aria-label={usual.label} className="rounded-lg border border-dashed border-neutral-300 px-3" data-usual>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-expanded={usualOpen}
                aria-controls="move-usual-items"
                onClick={() => setUsualOpen((open) => !open)}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 text-left text-sm text-neutral-600"
              >
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-200 motion-reduce:transition-none ${usualOpen ? '' : '-rotate-90'}`}
                  aria-hidden="true"
                />
                <span className="truncate">
                  {usual.label}
                  {!usualOpen && <span className="tabular-nums"> · {usualLeft.length}</span>}
                </span>
              </button>
              <button
                type="button"
                onClick={() => addUsual(usualLeft.map((item) => item.line))}
                className="inline-flex min-h-11 shrink-0 items-center px-1 text-sm font-medium text-primary-700 hover:underline"
              >
                Add all
              </button>
            </div>
            {/* Height animates through grid rows (0fr ↔ 1fr), so the items slide up into the header. */}
            <div
              id="move-usual-items"
              className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
                usualOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
              inert={!usualOpen}
            >
              <div className="overflow-hidden">
                <div className="flex flex-wrap gap-2 pb-2.5">
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
              </div>
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
                      aria-invalid={(short && !asking) || undefined}
                      onChange={(event) => update(line.key, { quantity: event.target.value.replace(/[^0-9]/g, '') })}
                      className={`h-11 w-16 shrink-0 rounded-md border bg-white px-2 text-center text-base tabular-nums focus:ring-2 focus:outline-none ${
                        short && !asking
                          ? 'border-danger-500 focus:ring-danger-100'
                          : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-100'
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
                  {/* Asking (Part 5): what each has now - nothing moves until the Store moves it. */}
                  {asking ? (
                    <p className="text-xs tabular-nums text-neutral-700" data-asking-figures>
                      {to && toHas != null && `${to.name} has ${inUnit(toHas, option, unit)} · `}
                      {from && has != null && (has <= 0 ? `The ${from.name} has none` : `${from.name} has ${inUnit(has, option, unit)}`)}
                    </p>
                  ) : (
                  /* Both areas, before → after (§5.1), in the unit being moved and in the stock unit. */
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
                        {/* What's used there is learned from its closing count (Part 3.5), not ticked here
                            (owner, 2026-10-31: the person moving it doesn't know). */}
                        <dd className="text-neutral-800">
                          {!to.keepsStock ? (
                            to.confirms ? 'used there, once confirmed' : 'used there'
                          ) : toHas != null ? (
                            <>
                              <BeforeAfter before={toHas} after={short ? null : toHas + base} option={option} unit={unit} />
                              {/* Part 4: it waits for the area to confirm it. */}
                              {to.confirms && <span className="text-neutral-600"> once confirmed</span>}
                            </>
                          ) : null}
                        </dd>
                      </>
                    )}
                  </dl>
                  )}
                  {short && has != null && from && !asking && (
                    <p className="text-sm text-danger-700">
                      {has <= 0 ? `The ${from.name} has none.` : `The ${from.name} has ${inUnit(has, option, unit)}.`}
                    </p>
                  )}
                  {/* Filling a request: a line the Store can't give comes off the move, and the Kitchen is told. */}
                  {short && request?.lines.some((asked) => asked.productId === line.product.id) && (
                    <button
                      type="button"
                      disabled={moving}
                      onClick={() => {
                        setNoneHere((current) => [...current, line.product.id])
                        setLines((current) => current.filter((l) => l.key !== line.key))
                      }}
                      className="-my-2 inline-flex min-h-11 items-center self-start text-sm font-medium text-primary-700 hover:underline"
                    >
                      None in the {from?.name ?? 'store'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {/* What the Store said it has none of (Part 5), each one tap from going back on. */}
        {request && noneHere.length > 0 && (
          <p className="text-sm text-neutral-700" data-none-here>
            None in the {from?.name}:{' '}
            {noneHere.map((productId, index) => {
              const asked = request.lines.find((l) => l.productId === productId)
              return (
                <span key={productId}>
                  {index > 0 && ', '}
                  {asked?.productName}{' '}
                  <button
                    type="button"
                    disabled={moving}
                    onClick={() => {
                      setNoneHere((current) => current.filter((id) => id !== productId))
                      if (asked) {
                        void productsApi
                          .get(productId)
                          .then((product) => addProduct(product, String(asked.quantity - asked.moved), undefined, false))
                          .catch(() => undefined)
                      }
                    }}
                    className="font-medium text-primary-700 hover:underline"
                  >
                    (put back)
                  </button>
                </span>
              )
            })}
          </p>
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
      {onlyNone && to ? (
        <Button variant="action" className="w-full" loading={moving} onClick={() => void answerNone()}>
          Tell the {to.name}: none in the {from?.name}
        </Button>
      ) : asking && from ? (
        // Part 5: the button names the outcome - nothing moves until the Store moves it.
        <Button variant="action" className="w-full" disabled={!canMove} loading={moving} onClick={() => void ask()}>
          {ready.length === 0 ? `Ask the ${from.name}` : `Ask the ${from.name} for ${items}`}
        </Button>
      ) : (
        <Button variant="action" className="w-full" disabled={!canMove} loading={moving} onClick={() => void move()}>
          {!to
            ? 'Choose where it goes'
            : ready.length === 0
              ? `${verb} to ${to.name}`
              : to.confirms
                ? // Names what happens next (Part 4), short enough for a phone's button.
                  `${verb} ${items} · ${to.name} will confirm`
                : `${verb} ${items} to ${to.name}`}
        </Button>
      )}
      {!online && ready.length > 0 && (
        <p className="text-center text-xs text-neutral-600">You're offline. It's kept on this phone and goes when you're connected.</p>
      )}
    </div>
  )
  return children({ body, action, asking })
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

/** "today 7:10 AM", or "Mon 7:10 AM" for an earlier day: when a request was asked. */
function formatAskedAt(iso: string): string {
  const when = new Date(iso)
  const time = when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return when.toDateString() === new Date().toDateString()
    ? `today ${time}`
    : `${when.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`
}
