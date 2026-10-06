import { usePendingStock } from '@/features/outbox/useOutbox'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Delete, Search, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { PERMISSIONS } from '@/auth/permissions'
import { Stamp, type StampKind } from '@/components/Stamp'
import { useDialogBehaviour } from '@/components/useDialogBehaviour'
import { useCatalogList, useCatalogState } from '@/features/catalog/useCatalog'
import { discardOp, getOutboxState, isInFlight, submitStockWrite } from '@/features/outbox/outboxStore'
import { useOutboxState } from '@/features/outbox/useOutbox'
import { stockApi } from '@/features/products/api/stockApi'
import { StockFigure } from '@/features/products/components/StockFigure'
import { useProductVendors } from '@/features/products/hooks/useProductVendors'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { Product, UnitOption } from '@/features/products/types'
import {
  formatEnteredAndBase,
  formatNumber,
  pluraliseUnitNoun,
  roundsToZeroMessage,
  stockUnitWord,
  unitNoun,
} from '@/features/products/unitCopy'
import {
  convertsCleanly,
  convertsToWholeCount,
  defaultUnitOption,
  exactBaseQuantity,
  isCountedInWholeUnits,
  productsOwnUnits,
  resolveUnitSymbol,
  stockUnitLabel,
  stockUnitOption,
  toBaseQuantity,
  unitOptionsForProduct,
} from '@/features/products/unitSet'
import { SyncPill } from '@/features/sync/SyncPill'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAppError } from '@/types/api'

type Mode = 'in' | 'out' | 'count'

// The same names as everywhere else in the app (it said Receive and Issue, warehouse words a
// shopkeeper had to guess at), each with one line saying what it does — Count most of all.
const MODES: { value: Mode; label: string; verb: string; meaning: string }[] = [
  { value: 'in', label: 'Stock in', verb: 'Stock in', meaning: 'Goods coming in, like a delivery or a return. Adds them to your stock.' },
  { value: 'out', label: 'Stock out', verb: 'Stock out', meaning: 'Goods going out: sold, used or sent away. Takes them off your stock.' },
  {
    value: 'count',
    label: 'Count',
    verb: 'Counted',
    meaning: "Count what's on the shelf. The app's figure is corrected to match, and the difference goes into the history.",
  },
]
/** The Record button says what it will do: "Stock in 2 bags (100 kg)". */
const ACTION: Record<Mode, string> = { in: 'Stock in', out: 'Stock out', count: 'Record count:' }

/** One write made in this session, and where it stands. */
interface SessionEntry {
  key: string
  mode: Mode
  productId: string
  productName: string
  summary: string
  /** Sent at once: the movement, for Undo. Saved on the phone: the outbox write. */
  movementId?: string
  opId?: string
  undone?: boolean
}

/** How long the stamp stays on screen before the next item. */
const STAMP_MS = 900

/**
 * Quick mode (C4): the phone at the gate. Receive, Issue or Count, one product after another —
 * scan or type to find it, a big keypad for the amount, the stamp, and straight on to the next.
 * Built for one hand, a glove and a dim store: big targets, big type, nothing to read twice.
 *
 * Everything goes through the outbox, so it works offline exactly as it does online, and the
 * search reads the on-device catalogue — a barcode scanner typing into the box finds the product
 * with no connection at all. The unit rules are the stock sheets' own (`UNIT_UX_CONTRACT.md`): a
 * delivery starts in the pack, an issue and a count in the stock unit (§9.3).
 */
export function QuickModePage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const permissions = user?.type === 'tenant' ? user.permissions : []
  const allowed: Record<Mode, boolean> = {
    in: permissions.includes(PERMISSIONS.STOCK_IN),
    out: permissions.includes(PERMISSIONS.STOCK_OUT),
    count: permissions.includes(PERMISSIONS.MANAGE_INVENTORY),
  }
  const requested = params.get('mode') as Mode | null
  const mode: Mode = requested && allowed[requested] ? requested : (MODES.find((m) => allowed[m.value])?.value ?? 'in')

  const [product, setProduct] = useState<Product | null>(null)
  const [flash, setFlash] = useState<{ kind: StampKind; text: string } | null>(null)
  const [session, setSession] = useState<SessionEntry[]>([])
  const searchRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // A full screen over the workspace, so it behaves as a dialog does (Phase H accessibility): the
  // workspace behind is inert - out of the tab order and unread - and Tab stays in here. Escape
  // steps back: a typed search is cleared first (the browser does that), then the chosen product,
  // then quick mode itself. A scanner never sends Escape, so a scan is never interrupted by it.
  useDialogBehaviour(rootRef, true, () => {
    const active = document.activeElement
    if (active instanceof HTMLInputElement && active.id === 'quick-search' && active.value !== '') return
    if (product) {
      setProduct(null)
      return
    }
    navigate('/app/products')
  })

  function chooseMode(next: Mode) {
    setParams({ mode: next }, { replace: true })
    setProduct(null)
  }

  function recorded(entry: SessionEntry, kind: StampKind) {
    setSession((current) => [entry, ...current])
    setProduct(null)
    setFlash({ kind, text: `${entry.summary} · ${entry.productName}` })
    window.setTimeout(() => {
      setFlash(null)
      searchRef.current?.focus()
    }, STAMP_MS)
  }

  return createPortal(
    // Over the workspace's own chrome — and over toasts (z-40), which would otherwise cover the
    // Record button; dialogs (the sync centre, z-50) still open above it.
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-mode-title"
      className="fixed inset-0 z-[45] flex flex-col bg-white text-neutral-900"
    >
      <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
        <button
          type="button"
          onClick={() => navigate('/app/products')}
          className="inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-base font-medium text-neutral-700 hover:bg-neutral-100"
        >
          <X className="h-5 w-5" aria-hidden="true" />
          Exit
        </button>
        <h1 id="quick-mode-title" className="text-base font-semibold">
          Quick mode
        </h1>
        <SyncPill large />
      </header>

      <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-2">
          <div
            role="group"
            aria-label="What are you doing?"
            aria-describedby="quick-mode-meaning"
            className="grid grid-cols-3 gap-1 rounded-lg bg-neutral-100 p-1"
          >
            {MODES.filter((m) => allowed[m.value]).map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={mode === m.value}
                onClick={() => chooseMode(m.value)}
                className={`h-12 rounded-md text-base font-semibold ${
                  mode === m.value ? 'bg-primary-600 text-white shadow-sm' : 'text-neutral-600'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p id="quick-mode-meaning" className="text-sm text-neutral-600">
            {MODES.find((m) => m.value === mode)?.meaning}
          </p>
        </div>

        {flash ? (
          <StampFlash kind={flash.kind} text={flash.text} />
        ) : product ? (
          <AmountStep
            key={`${product.id}-${mode}`}
            mode={mode}
            product={product}
            onBack={() => setProduct(null)}
            onRecorded={recorded}
          />
        ) : (
          <FindStep inputRef={searchRef} onPick={setProduct} />
        )}

        <SessionList entries={session} onUndone={(key) => setSession((all) => all.map((e) => (e.key === key ? { ...e, undone: true } : e)))} />
      </div>
    </div>,
    document.body,
  )
}

// --------------------------------------------------------------------------------------- find

function FindStep({ inputRef, onPick }: { inputRef: RefObject<HTMLInputElement | null>; onPick: (product: Product) => void }) {
  const [term, setTerm] = useState('')
  const catalog = useCatalogState()
  const onDevice = catalog.phase === 'ready'
  const search = term.trim()
  const list = useCatalogList(
    { search, status: 'active', categoryId: '', stockStatus: 'all', sort: { field: 'name', direction: 'asc' } },
    onDevice && search !== '',
  )
  const server = useProducts({ search: search || undefined, active: true, size: 8, page: 0, sort: 'name,asc' }, { enabled: !onDevice && search !== '' })
  const { loadRange } = list
  useEffect(() => {
    if (onDevice && search) loadRange(0, 7)
  }, [onDevice, search, loadRange])

  const results: Product[] = useMemo(() => {
    if (!search) return []
    if (onDevice) {
      const rows: Product[] = []
      for (let i = 0; i < Math.min(8, list.total); i++) {
        const row = list.rowAt(i)
        if (row) rows.push(row)
      }
      return rows
    }
    return server.data?.content ?? []
  }, [search, onDevice, list, server.data])

  useEffect(() => {
    inputRef.current?.focus()
  }, [inputRef])

  /**
   * Enter: a scanner's code, or a search with one obvious answer. A scanner types the code and
   * presses Enter in the same instant — before the search has answered — so an early Enter waits
   * for the answer to the term it was pressed on, then picks.
   */
  const [enterOn, setEnterOn] = useState<string | null>(null)
  const answered = onDevice ? list.ready : !server.loading
  function pickFromEnter(): boolean {
    const exact = results.find((p) => p.sku.toLowerCase() === search.toLowerCase())
    if (exact) {
      onPick(exact)
      return true
    }
    if (results.length === 1) {
      onPick(results[0])
      return true
    }
    return false
  }
  useEffect(() => {
    if (enterOn == null || enterOn !== search) return
    // Picked, or more than one match (the person taps the right one): either way, done waiting.
    if (pickFromEnter() || (answered && results.length > 1)) setEnterOn(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterOn, search, results, answered])
  useEffect(() => {
    if (enterOn == null) return
    const timer = window.setTimeout(() => setEnterOn(null), 3000)
    return () => window.clearTimeout(timer)
  }, [enterOn])

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
        <label htmlFor="quick-search" className="sr-only">
          Scan, or type a name or code
        </label>
        <input
          ref={inputRef}
          id="quick-search"
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (!pickFromEnter()) setEnterOn(search)
            }
          }}
          placeholder="Scan, or type a name or code"
          className="h-14 w-full rounded-lg border-2 border-neutral-300 bg-white pr-4 pl-12 text-lg text-neutral-900 placeholder:text-neutral-400 focus:border-primary-600 focus:outline-none"
        />
      </div>
      {search && results.length === 0 && (
        <p className="px-1 text-base text-neutral-600">Nothing matches “{search}”.</p>
      )}
      <ul className="flex flex-col gap-2">
        {results.map((product) => (
          <li key={product.id}>
            <FoundRow product={product} onPick={onPick} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function FoundRow({ product, onPick }: { product: Product; onPick: (product: Product) => void }) {
  const { options } = useUnitOfMeasureOptions()
  const unit = resolveUnitSymbol(product.unitOfMeasure, options)
  return (
    <button
      type="button"
      onClick={() => onPick(product)}
      className="flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-left hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold text-neutral-900">{product.name}</span>
        <span className="block truncate text-sm text-neutral-500">{product.sku}</span>
      </span>
      <span className="shrink-0 text-right text-base font-semibold tabular-nums">
        {formatNumber(product.quantityOnHand)} <span className="text-sm font-normal text-neutral-500">{stockUnitWord(unit, product.quantityOnHand)}</span>
      </span>
    </button>
  )
}

// ------------------------------------------------------------------------------------- amount

function AmountStep({
  mode,
  product,
  onBack,
  onRecorded,
}: {
  mode: Mode
  product: Product
  onBack: () => void
  onRecorded: (entry: SessionEntry, kind: StampKind) => void
}) {
  const { options } = useUnitOfMeasureOptions()
  const online = useOnlineStatus()
  const unitOptions = unitOptionsForProduct(product, options)
  const offered = productsOwnUnits(unitOptions)
  // §9.3, as in the sheets: a delivery in the pack, an issue and a count in the stock unit.
  const [unitLabel, setUnitLabel] = useState<string>(
    () => (mode === 'in' ? defaultUnitOption(unitOptions) : stockUnitOption(unitOptions)).label,
  )
  const option: UnitOption = offered.find((o) => o.label === unitLabel) ?? stockUnitOption(unitOptions)
  const stockText = stockUnitLabel(unitOptions)
  const symbol = resolveUnitSymbol(product.unitOfMeasure, options)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // A delivery from a product with suppliers must name one; the preferred one is the default.
  const vendors = useProductVendors(mode === 'in' ? product.id : undefined)
  const supplierList = vendors.data
  const [vendorId, setVendorId] = useState<string | null>(null)
  const chosenVendor =
    supplierList.find((v) => v.companyVendorId === vendorId) ?? supplierList.find((v) => v.isPreferred) ?? supplierList[0]

  const quantity = typed === '' || typed === '.' ? 0 : Number(typed)
  const base = toBaseQuantity(quantity, option)
  const summary = formatEnteredAndBase(quantity, option, base, stockText)
  const wholeOnly = isCountedInWholeUnits(product.unitOfMeasure, options)
  // What the app says is on hand counts this phone's own changes not yet folded into the figure (the
  // list shows them as "−3 kg waiting"): a count right after a sale must compare against the stock
  // after that sale, or the difference it shows is off by exactly that sale.
  const pending = usePendingStock(product.id)
  const appSays = product.quantityOnHand + pending.delta
  const difference = mode === 'count' && typed !== '' ? exactBaseQuantity(quantity, option) - appSays : null

  function problem(): string | null {
    if (typed === '') return 'Type how many.'
    if (mode !== 'count' && quantity <= 0) return 'Type a number above 0.'
    if (quantity > 0 && !convertsCleanly(quantity, option)) return roundsToZeroMessage(quantity, option, stockText)
    if (!convertsToWholeCount(quantity, option, wholeOnly) || (mode === 'count' && !Number.isInteger(exactBaseQuantity(quantity, option)))) {
      return `That doesn't come to a whole number of ${stockUnitWord(symbol, 2)}.`
    }
    return null
  }

  function press(key: string) {
    setError(null)
    if (key === 'back') return setTyped((t) => t.slice(0, -1))
    if (key === '.' && typed.includes('.')) return
    if (typed.replace('.', '').length >= 7) return
    setTyped((t) => (t === '0' && key !== '.' ? key : t + key))
  }

  async function record() {
    const why = problem()
    if (why) return setError(why)
    setSaving(true)
    setError(null)
    try {
      const outcome =
        mode === 'count'
          ? await submitStockWrite({
              kind: 'COUNT',
              productId: product.id,
              productName: product.name,
              summary: `${formatNumber(exactBaseQuantity(quantity, option))} ${stockUnitWord(symbol, exactBaseQuantity(quantity, option))}`,
              payload: { countedQuantity: exactBaseQuantity(quantity, option) },
            })
          : mode === 'in'
            ? await submitStockWrite({
                kind: 'STOCK_IN',
                productId: product.id,
                productName: product.name,
                summary,
                payload: {
                  quantity,
                  unit: option.code || undefined,
                  // As the stock-in sheet: a pack is sent with its size, so it resolves to THIS pack.
                  packagingUnit: option.isPack ? option.code : undefined,
                  packagingSize: option.isPack ? option.factorToStockUnit : undefined,
                  companyVendorId: chosenVendor?.companyVendorId,
                },
                baseDelta: base,
              })
            : await submitStockWrite({
                kind: 'STOCK_OUT',
                productId: product.id,
                productName: product.name,
                summary,
                payload: { quantity, unit: option.code || undefined },
                baseDelta: -base,
              })
      const entry: SessionEntry = {
        key: crypto.randomUUID(),
        mode,
        productId: product.id,
        productName: product.name,
        summary,
        ...(outcome.status === 'sent' ? { movementId: outcome.response.movement?.id } : { opId: outcome.op.id }),
      }
      onRecorded(entry, outcome.status === 'sent' ? 'synced' : 'recorded')
      setSaving(false)
    } catch (err) {
      setError(isAppError(err) ? err.message : 'Could not record that. Try again.')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{product.name}</p>
          <p className="text-sm text-neutral-500">
            On hand {formatNumber(appSays)} {stockUnitWord(symbol, appSays)}
          </p>
        </div>
        <button type="button" onClick={onBack} className="h-11 shrink-0 rounded-md px-3 text-base font-medium text-primary-700 hover:bg-primary-50">
          Change
        </button>
      </div>

      {mode === 'in' && supplierList.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">From</span>
          <select
            value={chosenVendor?.companyVendorId ?? ''}
            onChange={(event) => setVendorId(event.target.value)}
            className="h-12 rounded-md border border-neutral-300 bg-white px-3 text-base"
          >
            {supplierList.map((v) => (
              <option key={v.companyVendorId} value={v.companyVendorId}>
                {v.companyVendorName}
              </option>
            ))}
          </select>
        </label>
      )}

      {offered.length > 1 && (
        <div role="group" aria-label="Counted in" className="flex gap-2">
          {offered.map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={o.label === option.label}
              onClick={() => setUnitLabel(o.label)}
              className={`h-11 flex-1 rounded-md border-2 px-2 text-base font-medium ${
                o.label === option.label ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-neutral-200 text-neutral-700'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {/* The figure being typed, big enough to read at arm's length. */}
      <div className="rounded-lg border-2 border-neutral-200 px-4 py-3" aria-live="polite">
        <p className="text-sm text-neutral-500">{mode === 'count' ? 'On the shelf now' : mode === 'in' ? 'How many arrived' : 'How many went out'}</p>
        <p className="mt-1 flex items-baseline gap-2 tabular-nums" data-quick-amount>
          <span className="text-5xl font-semibold">{typed || '0'}</span>
          <span className="text-xl text-neutral-500">{pluraliseUnitNoun(unitNoun(option), quantity || 2)}</span>
        </p>
        {quantity > 0 && !option.isStockUnit && <p className="mt-1 text-base text-neutral-600">{summary}</p>}
        {difference != null && (
          <div className="mt-2 flex items-baseline gap-2">
            {difference === 0 ? (
              <span className="text-base font-medium text-accent-700">Matches what the app says.</span>
            ) : (
              <>
                <StockFigure quantity={difference} unit={symbol} signed size="md" />
                <span className="text-base text-neutral-600">vs what the app says</span>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-base font-medium text-danger-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            className="h-16 rounded-lg border border-neutral-200 bg-neutral-50 text-2xl font-semibold text-neutral-900 active:bg-neutral-200"
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          onClick={() => press('back')}
          aria-label="Delete last digit"
          className="flex h-16 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-700 active:bg-neutral-200"
        >
          <Delete className="h-7 w-7" aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => void record()}
        disabled={saving}
        className="h-16 rounded-lg bg-action text-lg font-semibold text-white hover:bg-action-hover disabled:opacity-60"
      >
        {saving ? 'Recording…' : typed ? `${ACTION[mode]} ${summary}` : 'Record'}
      </button>
      {!online && <p className="text-center text-sm text-neutral-600">Offline: it's saved on this phone and sent when you're back.</p>}
    </div>
  )
}

// -------------------------------------------------------------------------------------- stamp

function StampFlash({ kind, text }: { kind: StampKind; text: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-4 rounded-lg border-2 border-neutral-200 px-4 py-10 text-center">
      <div className="scale-150">
        <Stamp kind={kind} land />
      </div>
      <p className="text-lg font-semibold tabular-nums">{text}</p>
      <p className="text-sm text-neutral-500">{kind === 'synced' ? 'Recorded.' : 'Saved on this phone.'} Next item…</p>
    </div>
  )
}

// ------------------------------------------------------------------------------------ session

function SessionList({ entries, onUndone }: { entries: SessionEntry[]; onUndone: (key: string) => void }) {
  const { ops, recentlySent } = useOutboxState()
  const [error, setError] = useState<string | null>(null)
  if (entries.length === 0) return null

  function stampFor(entry: SessionEntry): StampKind {
    if (entry.movementId) return 'synced'
    const waiting = ops.find((op) => op.id === entry.opId)
    if (waiting) return waiting.status === 'needs_attention' ? 'check' : 'recorded'
    return recentlySent.some((op) => op.id === entry.opId) ? 'synced' : 'recorded'
  }

  async function undo(entry: SessionEntry) {
    setError(null)
    try {
      if (entry.movementId) {
        await stockApi.voidWrite(entry.productId, entry.movementId)
      } else if (entry.opId) {
        if (isInFlight(entry.opId) || !getOutboxState().ops.some((op) => op.id === entry.opId)) {
          throw new Error("It's already gone to the server. Record a count to correct the figure.")
        }
        await discardOp(entry.opId)
      }
      onUndone(entry.key)
    } catch (err) {
      setError(isAppError(err) ? err.message : err instanceof Error ? err.message : "Couldn't undo that.")
    }
  }

  const latest = entries.find((entry) => !entry.undone)
  return (
    <section aria-labelledby="quick-session-heading" className="flex flex-col gap-2 border-t border-neutral-200 pt-4">
      <h2 id="quick-session-heading" className="text-sm font-semibold text-neutral-600">
        This session · {entries.filter((e) => !e.undone).length}
      </h2>
      {error && (
        <p role="alert" className="text-sm text-danger-700">
          {error}
        </p>
      )}
      <ul className="flex flex-col divide-y divide-neutral-100">
        {entries.map((entry) => (
          <li key={entry.key} className={`flex items-center justify-between gap-3 py-2.5 ${entry.undone ? 'opacity-50' : ''}`}>
            <span className="min-w-0">
              <span className={`block truncate text-base font-medium ${entry.undone ? 'line-through' : ''}`}>{entry.productName}</span>
              <span className="block truncate text-sm text-neutral-500 tabular-nums">
                {MODES.find((m) => m.value === entry.mode)?.verb} · {entry.summary}
              </span>
            </span>
            {entry.undone ? (
              <span className="text-sm text-neutral-500">Undone</span>
            ) : (
              <span className="flex shrink-0 items-center gap-2">
                <Stamp kind={stampFor(entry)} />
                {entry === latest && (
                  <button type="button" onClick={() => void undo(entry)} className="h-10 rounded-md px-2 text-sm font-semibold text-primary-700 underline">
                    Undo
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
