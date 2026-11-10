import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { useSheetArea } from '@/features/branches/useSheetBranch'
import { CountShortfall } from '@/features/branches/CountShortfall'
import { areaShortAs, countPlace, placeFigure, type ShortAs } from '@/features/branches/areas'
import { QuickAreaTitle } from '@/features/quick/QuickAreaTitle'
import { MoveEditor, type Moved } from '@/features/moves/MoveEditor'
import { movesApi } from '@/features/moves/movesApi'
import { requestsApi } from '@/features/requests/requestsApi'
import { WaitingMovesLine } from '@/features/moves/WaitingMovesLine'
import { usePendingStock } from '@/features/outbox/useOutbox'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { Delete, Search, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Stamp, type StampKind } from '@/components/Stamp'
import { useDialogBehaviour } from '@/components/useDialogBehaviour'
import { applyMoveResult, discardOp, getOutboxState, isInFlight, submitStockWrite } from '@/features/outbox/outboxStore'
import { useOutboxState } from '@/features/outbox/useOutbox'
import { stockApi } from '@/features/products/api/stockApi'
import { StockFigure } from '@/features/products/components/StockFigure'
import { useProductVendors } from '@/features/products/hooks/useProductVendors'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { OutReason, Product, UnitOption } from '@/features/products/types'
import {
  formatEnteredAndBase,
  formatNumber,
  formatQuantityInUnit,
  formatRestated,
  pluraliseUnitNoun,
  roundsToZeroMessage,
  stockUnitWord,
  unitNoun,
} from '@/features/products/unitCopy'
import {
  buildPackOption,
  buildUnitOptions,
  convertsCleanly,
  convertsToWholeCount,
  defaultUnitOption,
  isCountedInWholeUnits,
  productsOwnUnits,
  resolveUnitSymbol,
  roundQuantity,
  stockUnitLabel,
  stockUnitOption,
  supplierPacks,
  toBaseQuantity,
  usedInOption,
} from '@/features/products/unitSet'
import { OUT_REASONS, outReasonLabel } from '@/features/stock/outReasons'
import { useProductFinder } from '@/features/catalog/useProductFinder'
import { useCountBoxes } from '@/features/products/useCountBoxes'
import { MoreCountUnits, countUnitName } from '@/features/products/components/CountUnitLines'
import { useCatalogState } from '@/features/catalog/useCatalog'
import { CountList, type CountedHere, type RowCounted } from '@/features/quick/CountList'
import { formatMoney } from '@/features/selling/money'
import { MySalesToday } from '@/features/selling/sale/MySalesToday'
import { SaleBasketEditor } from '@/features/selling/sale/SaleBasketEditor'
import { undoSale, useSaleBasket, type RecordedSale } from '@/features/selling/sale/useSaleBasket'
import { MODES, useQuickModeTabs, type Mode } from '@/features/quick/quickTabs'
import { WhatsAppTell } from '@/features/requests/WhatsAppTell'
import type { AskShare } from '@/features/requests/whatsAppShare'
import { SyncPill } from '@/features/sync/SyncPill'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAppError } from '@/types/api'


/**
 * Stock out's line, built for what this person has (§6.3, STOCK_AREAS_PART_3.md, owner 2026-11-01): where sales
 * are recorded it's for everything but a sale; at a branch with areas, giving to the kitchen is a move. It points
 * at Move or Sell only when that is one of their buttons - never at one they don't have.
 */
function outMeaning({ sells, areas, moveButton, sellButton }: { sells: boolean; areas: boolean; moveButton: boolean; sellButton: boolean }): string {
  const what = sells
    ? areas
      ? 'Used or thrown away, not sold.'
      : 'Goods going out without a sale: used, spoilt or sent away.'
    : areas
      ? 'Used, sold or thrown away.'
      : 'Goods going out: sold, used or sent away. Takes them off your stock.'
  if (areas && moveButton) return `${what} To another area, use Move.`
  if (sells && sellButton) return `${what} For a customer, use Sell.`
  return areas && !sells ? `${what} Takes them off your stock.` : what
}
/** The Record button says what it will do: "Stock in 2 bags (100 kg)". */
const ACTION: Record<Exclude<Mode, 'sell' | 'move' | 'ask'>, string> = { in: 'Stock in', out: 'Stock out', count: 'Record count:' }
const GRID_COLS = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4']

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
  /** A sale: its lines, each sent or waiting, undone together. */
  sale?: RecordedSale
  /** A move between areas that reached the server, for Undo (a queued one is `opId`). */
  moveId?: string
  /** Where it was recorded, as the title said at the time (owner, 2026-10-31): "Stock in · 1 set · Store". */
  areaName?: string
  /** An ask (Part 5): what to tell the Store's people on WhatsApp. */
  share?: AskShare
  /** When it was recorded: a count today moves the product to "Counted today" (sheets plan Part 5). */
  at?: number
  /** A count as it was typed (V85), for Count again on the list. */
  countedAs?: { unit: string; quantity: number }[]
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
  const branch = useOptionalWorkingBranch()
  const branchHere = branch?.isMultiBranch && !branch.isAll ? branch.working?.name : undefined
  // Where in the branch every scan lands, at a branch with a choice of areas (V60). Chosen once for the
  // session, like the reason; a sale chooses its own on the basket.
  const area = useSheetArea(branch && !branch.isAll ? branch.working : null)
  // Every figure here is this place's: the area's, else the branch's (sheets plan Part 4).
  const place: Place = { branchId: branch && !branch.isAll ? branch.working?.id : undefined, areaId: area.areaId, areaName: area.areaName }
  // Where a count from the list lands: the area chosen, or a branch's only area (owner, 2026-11-10).
  const counting = countPlace(branch && !branch.isAll ? branch.working : null, area)
  const [params, setParams] = useSearchParams()
  // The buttons along the top (owner, 2026-11-01): the person's own choice of up to four, kept on their account,
  // else the app's for where they work - never one their role doesn't give them. Count they may do but didn't
  // keep a button for stays one small link beside the line below.
  const quickTabs = useQuickModeTabs()
  const tabs = MODES.filter((m) => quickTabs.tabs.includes(m.value))
  const movesHere = quickTabs.movesHere
  const sells = quickTabs.available.includes('sell')
  const countLink = quickTabs.available.includes('count') && !quickTabs.tabs.includes('count')
  const requested = params.get('mode') as Mode | null
  // A link may open another button they may use (the product page's Count); otherwise the first of theirs.
  const mode: Mode = requested && quickTabs.available.includes(requested) ? requested : (tabs[0]?.value ?? 'in')

  const [product, setProduct] = useState<Product | null>(null)
  const [flash, setFlash] = useState<{ kind: StampKind; text: string } | null>(null)
  const [session, setSession] = useState<SessionEntry[]>([])
  /**
   * The stock-out reason, sticky for this visit to quick mode (`SELLING_PRICE_PLAN.md` §6.3):
   * throwing out twelve expired items is one choice, not twelve. Optional and never defaulted, and it
   * goes when quick mode closes - a reason left over from yesterday would label today's items wrong.
   * Every stamp repeats it, so it is never forgotten that it is on.
   */
  const [outReason, setOutReason] = useState<OutReason | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  // Held here, not in the Sell step, so the basket (a draft on the phone) outlives the stamp.
  const basket = useSaleBasket()
  const [salesRecorded, setSalesRecorded] = useState(0)
  const [movesRecorded, setMovesRecorded] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  // A full screen over the workspace, so it behaves as a dialog does (Phase H accessibility): the
  // workspace behind is inert - out of the tab order and unread - and Tab stays in here. Escape
  // steps back: a typed search is cleared first (the browser does that), then the chosen product,
  // then quick mode itself. A scanner never sends Escape, so a scan is never interrupted by it.
  useDialogBehaviour(rootRef, true, () => {
    const active = document.activeElement
    if (active instanceof HTMLInputElement && (active.id === 'quick-search' || active.id === 'sale-search') && active.value !== '') return
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

  function saleRecorded(sale: RecordedSale) {
    const kept = sale.lines.filter((line) => line.status !== 'refused')
    setSalesRecorded((n) => n + 1)
    if (kept.length === 0) return // all refused: they are still in the basket, saying why
    const items = `${kept.length} ${kept.length === 1 ? 'item' : 'items'}`
    recorded(
      {
        key: sale.saleId,
        mode: 'sell',
        productId: '',
        productName: sale.label,
        summary: `${items} · ${formatMoney(sale.total)}`,
        sale,
      },
      kept.every((line) => line.status === 'sent') ? 'synced' : 'recorded',
    )
  }

  function moveRecorded(moved: Moved) {
    setMovesRecorded((n) => n + 1)
    // Asked (Part 5): "2 items · asked of the Store"; a request answered with none: "Told the Kitchen · none".
    const said =
      moved.status === 'asked'
        ? { key: moved.requestId, productName: `${moved.route} · asked`, opId: moved.opId, share: moved.share }
        : moved.status === 'answered'
          ? { key: `answered-${Date.now()}`, productName: `${moved.route} · none in the store` }
          : {
              key: moved.status === 'sent' ? moved.move.id : moved.opId,
              productName: moved.waitingFor ? `${moved.route} · waiting for the ${moved.waitingFor}` : moved.route,
              moveId: moved.status === 'sent' ? moved.move.id : undefined,
              opId: moved.status === 'queued' ? moved.opId : undefined,
            }
    recorded(
      { mode: moved.status === 'asked' ? 'ask' : 'move', productId: '', summary: moved.items, ...said },
      moved.status === 'queued' || (moved.status === 'asked' && moved.opId) ? 'recorded' : 'synced',
    )
  }

  function recorded(recordedEntry: SessionEntry, kind: StampKind) {
    area.remember()
    // A move says its own route; everything else lands in the area in the title.
    const entry =
      recordedEntry.mode === 'move' || recordedEntry.mode === 'ask' || !area.areaName
        ? recordedEntry
        : { ...recordedEntry, areaName: area.areaName }
    const where = entry.areaName ? ` · ${entry.areaName}` : ''
    setSession((current) => [entry, ...current])
    setProduct(null)
    setFlash({ kind, text: entry.sale ? `Sale · ${entry.summary}${where}` : `${entry.summary} · ${entry.productName}${where}` })
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
          {/* Where every scan here lands (UX §5.2): "Quick mode · Oshodi". */}
          Quick mode{branchHere ? ` · ${branchHere}` : ''}
          {/* Where every scan lands, changed right here (Move has its own From and To). */}
          {mode !== 'move' && mode !== 'ask' && (
            <QuickAreaTitle areaId={area.areaId} areaName={area.areaName} choices={area.choices} onChoose={area.choose} />
          )}
        </h1>
        <SyncPill large />
      </header>
      {/* Areas that confirm (Part 4): what's waiting for this person, one line under the title. */}
      <WaitingMovesLine bar />

      <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-2">
          <div
            role="group"
            aria-label="What are you doing?"
            aria-describedby="quick-mode-meaning"
            aria-busy={!quickTabs.ready || undefined}
            className={`grid ${GRID_COLS[tabs.length]} min-h-14 gap-1 rounded-lg bg-neutral-100 p-1`}
          >
            {/* Until their own buttons are known, the row keeps its place, empty - no flash of the wrong ones. */}
            {quickTabs.ready && tabs.map((m) => (
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
          {/* Count shares the explanation's line, so it costs no height above the keyboard. */}
          <div className="flex items-start justify-between gap-3">
            <p id="quick-mode-meaning" className="text-sm text-neutral-600">
              {mode === 'out'
                ? outMeaning({
                    sells,
                    areas: movesHere,
                    moveButton: quickTabs.tabs.includes('move'),
                    sellButton: quickTabs.tabs.includes('sell'),
                  })
                : MODES.find((m) => m.value === mode)?.meaning}
            </p>
            {countLink && (
              <button
                type="button"
                aria-pressed={mode === 'count'}
                onClick={() => chooseMode(mode === 'count' ? (tabs[0]?.value ?? 'in') : 'count')}
                className="-my-3 inline-flex min-h-11 shrink-0 items-center px-1 text-sm font-medium whitespace-nowrap text-primary-700 hover:underline"
              >
                {mode === 'count' ? 'Done counting' : 'Count stock'}
              </button>
            )}
          </div>
          {mode === 'sell' && <MySalesToday refreshKey={salesRecorded} />}
          {mode === 'out' && <QuickReason value={outReason} onChange={setOutReason} />}
        </div>

        {flash ? (
          <StampFlash kind={flash.kind} text={flash.text} next={mode === 'sell' ? 'Next customer…' : 'Next item…'} />
        ) : mode === 'sell' ? (
          <div className="flex flex-col gap-4">
            <SaleBasketEditor basket={basket} onRecorded={saleRecorded} areaId={area.areaId ?? null} />
          </div>
        ) : mode === 'move' || mode === 'ask' ? (
          // A fresh editor after each move or ask: the stamp, then the next one.
          <MoveEditor key={`${mode}-${movesRecorded}`} intent={mode} onMoved={moveRecorded}>
            {({ body, action }) => (
              <div className="flex flex-col gap-3">
                {body}
                {action}
              </div>
            )}
          </MoveEditor>
        ) : product ? (
          <AmountStep
            key={`${product.id}-${mode}`}
            mode={mode}
            product={product}
            reason={mode === 'out' ? outReason : null}
            place={place}
            onBack={() => setProduct(null)}
            onRecorded={recorded}
          />
        ) : (
          <FindStep
            inputRef={searchRef}
            place={place}
            onPick={setProduct}
            // The closing count, from a list (sheets plan Part 5): every branch's, a branch with one area too (owner,
            // 2026-11-10). Sixty rows at a time; search finds the rest.
            countList={
              mode === 'count' && counting
                ? {
                    // Counted on its row (owner, 2026-11-09): into This session, no stamp screen in between.
                    onCounted: (row: RowCounted) => {
                      area.remember()
                      setSession((current) => [
                        { key: crypto.randomUUID(), mode: 'count', at: Date.now(), areaName: area.areaName, ...row },
                        ...current,
                      ])
                    },
                    areaId: counting.areaId,
                    areaName: counting.areaName,
                    countedHere: session
                      .filter((entry) => entry.mode === 'count' && !entry.undone && entry.areaName === place.areaName)
                      .map((entry) => ({
                        productId: entry.productId,
                        productName: entry.productName,
                        summary: entry.summary,
                        at: entry.at ?? Date.now(),
                        countedAs: entry.countedAs,
                      })),
                  }
                : null
            }
          />
        )}

        <SessionList entries={session} onUndone={(key) => setSession((all) => all.map((e) => (e.key === key ? { ...e, undone: true } : e)))} />
      </div>
    </div>,
    document.body,
  )
}

// --------------------------------------------------------------------------------------- find

/** Where quick mode records, and so whose figures it shows. */
interface Place {
  branchId: string | undefined
  areaId: string | undefined
  areaName: string | undefined
}

function FindStep({
  inputRef,
  place,
  onPick,
  countList,
}: {
  inputRef: RefObject<HTMLInputElement | null>
  place: Place
  onPick: (product: Product) => void
  countList: {
    areaId: string
    areaName?: string
    countedHere: CountedHere[]
    onCounted: (row: RowCounted) => void
  } | null
}) {
  const [term, setTerm] = useState('')
  const { search, results, onEnter } = useProductFinder(term, onPick)
  const catalog = useCatalogState()

  useEffect(() => {
    inputRef.current?.focus()
  }, [inputRef])

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
              onEnter()
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
            <FoundRow product={product} place={place} onPick={onPick} />
          </li>
        ))}
      </ul>
      {!search && countList && catalog.phase === 'ready' && (
        <CountList
          areaId={countList.areaId}
          areaName={countList.areaName}
          countedHere={countList.countedHere}
          onCounted={countList.onCounted}
        />
      )}
    </div>
  )
}

function FoundRow({ product, place, onPick }: { product: Product; place: Place; onPick: (product: Product) => void }) {
  const { options } = useUnitOfMeasureOptions()
  const unit = resolveUnitSymbol(product.unitOfMeasure, options)
  const here = placeFigure(product, place)
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
      {here.carried ? (
        <span className="shrink-0 text-right text-base font-semibold tabular-nums">
          {formatNumber(here.quantity)} <span className="text-sm font-normal text-neutral-500">{stockUnitWord(unit, here.quantity)}</span>
        </span>
      ) : (
        // Never had here: the row stays - it may be arriving here for the first time.
        <span className="shrink-0 text-right text-sm text-neutral-500">Not in {place.areaName}</span>
      )}
    </button>
  )
}

// ------------------------------------------------------------------------------------- amount

function AmountStep({
  mode,
  product,
  reason,
  place,
  onBack,
  onRecorded,
}: {
  mode: Exclude<Mode, 'sell' | 'move' | 'ask'>
  product: Product
  /** The session's stock-out reason, or null for none given. */
  reason: OutReason | null
  /** Where the session records: its area (V60) at a branch with a choice of them. */
  place: Place
  onBack: () => void
  onRecorded: (entry: SessionEntry, kind: StampKind) => void
}) {
  const { options, packagingOptions } = useUnitOfMeasureOptions()
  const online = useOnlineStatus()
  const areaId = place.areaId
  // The preferred supplier to start; "No supplier" is a choice too (sheets plan Part 3). '' is none, null untouched.
  const vendors = useProductVendors(mode === 'in' ? product.id : undefined)
  const supplierList = vendors.data
  const [vendorId, setVendorId] = useState<string | null>(null)
  const chosenVendor =
    vendorId === ''
      ? undefined
      : (supplierList.find((v) => v.companyVendorId === vendorId) ?? supplierList.find((v) => v.isPreferred) ?? supplierList[0])

  // Every unit it can be entered in here (owner, 2026-11-09). The row shows the everyday ones - the stock unit, the
  // packs and the product's own units; a delivery's follow its supplier (her 25 kg bag). "Other unit…" has the rest
  // (g, t) and, for a delivery, a pack nobody has set up yet, for this delivery only - as the stock-in panel does.
  const [extraPack, setExtraPack] = useState<{ packagingUnit: string; packagingSize: number } | null>(null)
  const unitOptions = buildUnitOptions({
    product,
    unitsOfMeasure: options,
    supplier: mode === 'in' ? supplierPacks(chosenVendor) : null,
    extraPack: mode === 'in' ? extraPack : null,
    serverOptions: mode === 'in' && chosenVendor ? (chosenVendor.unitOptions ?? null) : (product.unitOptions ?? null),
  })
  const offered = productsOwnUnits(unitOptions)
  const others = unitOptions.filter((o) => !offered.some((own) => own.label === o.label))
  // §9.3, as in the sheets: a delivery in the pack, an issue and a count in the stock unit.
  const [unitLabel, setUnitLabel] = useState<string>(
    // A stock-out or count starts in the product's usual unit, the cook's Derica (UNITS_PLAN.md Part 2).
    () => (mode === 'in' ? defaultUnitOption(unitOptions) : usedInOption(product, offered, stockUnitOption(unitOptions))).label,
  )
  const option: UnitOption = unitOptions.find((o) => o.label === unitLabel) ?? stockUnitOption(unitOptions)
  const [otherOpen, setOtherOpen] = useState(false)
  const usualOption = usedInOption(product, offered, stockUnitOption(unitOptions))
  const usual = usualOption.isStockUnit ? null : usualOption
  const stockText = stockUnitLabel(unitOptions)
  const symbol = resolveUnitSymbol(product.unitOfMeasure, options)
  const [typed, setTyped] = useState('')
  // A count is made in as many of the product's units as the shelf needs (owner, 2026-11-10): every unit a round
  // chip, the ones it's counted in already on, a box for each - "2 bags + 7 dericas". The keypad types into the
  // chosen box.
  const counting = mode === 'count'
  const count = useCountBoxes(product, offered)
  const [active, setActive] = useState(0)
  const activeBox = count.boxes[Math.min(active, count.boxes.length - 1)]
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // A count at a branch with areas (Part 3.5): what a shortfall becomes - the area's answer, or this count's.
  const branches = useOptionalWorkingBranch()?.branches ?? []
  const countedArea = mode === 'count' && areaId ? branches.flatMap((b) => b.areas ?? []).find((a) => a.id === areaId) : undefined
  const [shortChosen, setShortChosen] = useState<ShortAs | null>(null)

  const noun = (unit: UnitOption, amount: number) =>
    unit.isStockUnit ? stockUnitWord(symbol, amount) : pluraliseUnitNoun(unitNoun(unit), amount)
  const quantity = typed === '' || typed === '.' ? 0 : Number(typed)
  const base = counting ? (count.total ?? 0) : toBaseQuantity(quantity, option)
  const countedInStockUnits = count.boxes.length > 1 || !count.boxes[0].unit.isStockUnit
  const amountText = counting
    ? `${count.boxes
        .filter((box) => box.text.trim() !== '')
        .map((box) => formatQuantityInUnit(box.amount ?? 0, box.unit))
        .join(' + ')}${countedInStockUnits ? ` (${formatNumber(base)} ${stockUnitWord(symbol, base)})` : ''}`
    : formatEnteredAndBase(quantity, option, base, stockText)
  // The reason rides on the summary, so the stamp, the session list and the outbox all repeat it.
  const summary = reason ? `${amountText} · ${outReasonLabel(reason)}` : amountText
  const wholeOnly = isCountedInWholeUnits(product.unitOfMeasure, options)
  // What the app says is on hand counts this phone's own changes not yet folded into the figure (the
  // list shows them as "−3 kg waiting"): a count right after a sale must compare against the stock
  // after that sale, or the difference it shows is off by exactly that sale.
  const pending = usePendingStock(product.id, areaId)
  const appSays = roundQuantity(placeFigure(product, place).quantity + pending.delta)
  const anyTyped = counting ? count.anyTyped : typed !== ''
  const difference = counting && anyTyped && count.total != null ? roundQuantity(base - appSays) : null

  function problem(): string | null {
    if (!anyTyped) return 'Type how many.'
    if (counting) {
      if (count.total == null) return 'A number, to 3 decimal places.'
      for (const box of count.boxes) {
        const amount = box.amount ?? 0
        if (amount > 0 && !convertsCleanly(amount, box.unit)) return roundsToZeroMessage(amount, box.unit, stockText)
      }
      if (wholeOnly && !Number.isInteger(base)) return `That doesn't come to a whole number of ${stockUnitWord(symbol, 2)}.`
      return null
    }
    if (quantity <= 0) return 'Type a number above 0.'
    // More than is here: said now, so an offline stock out isn't refused later in the sync centre.
    if (mode === 'out' && base > appSays) {
      const has = `${formatNumber(Math.max(appSays, 0))} ${stockUnitWord(symbol, Math.max(appSays, 0))}`
      return place.areaName ? `The ${place.areaName} has ${has}.` : `There ${appSays === 1 ? 'is' : 'are'} ${has} here.`
    }
    if (quantity > 0 && !convertsCleanly(quantity, option)) return roundsToZeroMessage(quantity, option, stockText)
    if (!convertsToWholeCount(quantity, option, wholeOnly)) {
      return `That doesn't come to a whole number of ${stockUnitWord(symbol, 2)}.`
    }
    return null
  }

  function press(key: string) {
    setError(null)
    const current = counting ? activeBox.text : typed
    const set = (next: string) => (counting ? count.setText(count.boxes.indexOf(activeBox), next) : setTyped(next))
    if (key === 'back') return set(current.slice(0, -1))
    if (key === '.' && current.includes('.')) return
    if (current.replace('.', '').length >= 7) return
    set(current === '0' && key !== '.' ? key : current + key)
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
              summary: amountText,
              payload: { countedQuantity: base, areaId, shortAs: shortChosen ?? undefined, countedAs: count.countedAs },
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
                  areaId,
                },
                baseDelta: base,
              })
            : await submitStockWrite({
                kind: 'STOCK_OUT',
                productId: product.id,
                productName: product.name,
                summary,
                payload: { quantity, unit: option.code || undefined, reason: reason ?? undefined, areaId },
                baseDelta: -base,
              })
      const entry: SessionEntry = {
        key: crypto.randomUUID(),
        mode,
        productId: product.id,
        productName: product.name,
        summary,
        ...(outcome.status === 'sent' ? { movementId: outcome.response.movement?.id } : { opId: outcome.op.id }),
        ...(counting ? { countedAs: count.countedAs } : {}),
        at: Date.now(),
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
            {place.areaName ? `In the ${place.areaName}:` : 'On hand'} {formatNumber(appSays)} {stockUnitWord(symbol, appSays)}
            {/* And in its usual unit, the cook's dericas (UNITS_PLAN.md Part 2). */}
            {usual && appSays > 0 && ` (${formatRestated(appSays, usual)})`}
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
            <option value="">No supplier</option>
          </select>
        </label>
      )}

      {!counting && (offered.length > 1 || others.length > 0 || mode === 'in') && (
        <UnitRow
          units={[...offered, ...others.filter((o) => o.label === option.label)]}
          chosen={option}
          label="Counted in"
          onChoose={(o) => {
            setOtherOpen(false)
            setUnitLabel(o.label)
          }}
          others={others}
          otherOpen={otherOpen}
          onOtherOpen={setOtherOpen}
          // A pack nobody has set up yet: for a delivery only, and only this one.
          onNewPack={
            mode === 'in' && product.unitOfMeasure
              ? (pack) => {
                  setExtraPack(pack)
                  setOtherOpen(false)
                  const built = buildPackOption(pack, stockText, options)
                  if (built) setUnitLabel(built.label)
                }
              : undefined
          }
          packagingOptions={packagingOptions}
          stockText={stockText}
        />
      )}

      {/* The figure being typed, big enough to read at arm's length. */}
      <div className="rounded-lg border-2 border-neutral-200 px-4 py-3" aria-live="polite">
        <p className="text-sm text-neutral-500">{mode === 'count' ? 'On the shelf now' : mode === 'in' ? 'How many arrived' : 'How many went out'}</p>
        {counting && count.boxes.length > 1 ? (
          // A box per unit, the chosen one outlined; the keypad types into it (UNITS_PLAN.md Part 4).
          <div className="mt-1 grid grid-cols-2 gap-2" role="group" aria-label="Count in several units" data-quick-amount>
            {count.boxes.map((box, index) => (
              <div key={box.key} className="relative">
                <button
                  type="button"
                  aria-pressed={box === activeBox}
                  aria-label={`${box.text || '0'} ${noun(box.unit, box.amount || 2)}. Type ${noun(box.unit, 2)}`}
                  onClick={() => setActive(index)}
                  className={`flex min-h-16 w-full flex-col items-start rounded-md border-2 px-3 py-1.5 text-left tabular-nums ${
                    box === activeBox ? 'border-primary-600 bg-primary-50' : 'border-neutral-200'
                  }`}
                >
                  <span className="text-4xl leading-tight font-semibold">{box.text || '0'}</span>
                  <span className="text-base text-neutral-600">{noun(box.unit, box.amount || 2)}</span>
                </button>
                {box === activeBox && (
                  <button
                    type="button"
                    onClick={() => {
                      count.toggle(box.key)
                      setActive(0)
                    }}
                    aria-label={`Take ${countUnitName(box.unit, symbol)} off`}
                    className="absolute top-1 right-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-400 hover:bg-white hover:text-neutral-700"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 flex items-baseline gap-2 tabular-nums" data-quick-amount>
            <span className="text-5xl font-semibold">{(counting ? activeBox.text : typed) || '0'}</span>
            <span className="text-xl text-neutral-500">
              {counting ? noun(activeBox.unit, activeBox.amount || 2) : pluraliseUnitNoun(unitNoun(option), quantity || 2)}
            </span>
          </p>
        )}
        {/* The product's other units, a tap away (owner, 2026-11-10): "+ Cup" adds its box and types into it. */}
        {counting && (
          <div className="mt-2">
            <MoreCountUnits count={count} productName={product.name} stockSymbol={symbol} size="lg" onAdded={setActive} />
          </div>
        )}
        {counting
          ? anyTyped && countedInStockUnits && count.total != null && (
              <p className="mt-1 text-base text-neutral-600" data-quick-total>
                = {formatNumber(base)} {stockUnitWord(symbol, base)}
              </p>
            )
          : quantity > 0 && !option.isStockUnit && <p className="mt-1 text-base text-neutral-600">{amountText}</p>}
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
        {countedArea && (
          <div className="mt-1">
            <CountShortfall
              area={countedArea}
              shortAs={shortChosen ?? areaShortAs(countedArea)}
              short={difference != null && difference < 0 ? `${formatNumber(-difference)} ${stockUnitWord(symbol, -difference)}` : null}
              onChange={setShortChosen}
            />
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
        {saving ? 'Recording…' : anyTyped ? `${ACTION[mode]} ${counting ? `${formatNumber(base)} ${stockUnitWord(symbol, base)}` : summary}` : 'Record'}
      </button>
      {!online && <p className="text-center text-sm text-neutral-600">Offline: it's saved on this phone and sent when you're back.</p>}
    </div>
  )
}

// --------------------------------------------------------------------------------------- units

/**
 * Quick mode's units (owner, 2026-11-09: "simple stupid"): the everyday ones as big buttons - the stock unit, the
 * packs (a delivery's supplier's too) and the product's own units - and one more button, "Other unit…", which opens
 * in place with the rest: the standard units (g, t) and, for a delivery, a pack nobody has set up yet. A unit picked
 * there joins the row while it's in use.
 */
function UnitRow({
  units,
  chosen,
  label,
  onChoose,
  others,
  otherOpen,
  onOtherOpen,
  onNewPack,
  packagingOptions,
  stockText,
}: {
  units: UnitOption[]
  chosen: UnitOption
  label: string
  onChoose: (unit: UnitOption) => void
  others: UnitOption[]
  otherOpen: boolean
  onOtherOpen: (open: boolean) => void
  onNewPack?: (pack: { packagingUnit: string; packagingSize: number }) => void
  packagingOptions: { code: string; label: string }[]
  stockText: string
}) {
  const [packCode, setPackCode] = useState('')
  const [packSize, setPackSize] = useState('')
  const size = Number(packSize)
  const packReady = packCode !== '' && packSize.trim() !== '' && Number.isFinite(size) && size > 0
  const hasMore = others.length > 0 || onNewPack != null
  const buttons = units.length + (hasMore ? 1 : 0)
  return (
    <div className="flex flex-col gap-2">
      {/* Four or more sit two to a row, so none is squeezed on a phone. */}
      <div role="group" aria-label={label} className={buttons > 3 ? 'grid grid-cols-2 gap-2' : 'flex gap-2'}>
        {units.map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={o.label === chosen.label}
            onClick={() => onChoose(o)}
            className={`h-11 flex-1 rounded-md border-2 px-2 text-base font-medium ${
              o.label === chosen.label ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-neutral-200 text-neutral-700'
            }`}
          >
            {o.label}
          </button>
        ))}
        {hasMore && (
          <button
            type="button"
            aria-expanded={otherOpen}
            onClick={() => onOtherOpen(!otherOpen)}
            className="h-11 flex-1 rounded-md border-2 border-dashed border-neutral-300 px-2 text-base font-medium text-primary-700"
          >
            Other unit…
          </button>
        )}
      </div>
      {otherOpen && (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3" role="group" aria-label="Other units">
          {others.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {others.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => onChoose(o)}
                  className="h-11 min-w-16 rounded-md border-2 border-neutral-200 bg-white px-3 text-base font-medium text-neutral-800"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {onNewPack && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-neutral-700">A pack not listed, for this delivery</p>
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor="quick-new-pack">
                  Pack
                </label>
                <select
                  id="quick-new-pack"
                  value={packCode}
                  onChange={(event) => setPackCode(event.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 text-base"
                >
                  <option value="">Bag, carton…</option>
                  {packagingOptions.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <span className="text-base text-neutral-600">of</span>
                <label className="sr-only" htmlFor="quick-new-pack-size">
                  How much one holds, in {stockText}
                </label>
                <input
                  id="quick-new-pack-size"
                  inputMode="decimal"
                  value={packSize}
                  onChange={(event) => setPackSize(event.target.value.replace(',', '.'))}
                  placeholder="25"
                  className="h-11 w-20 rounded-md border border-neutral-300 bg-white px-2 text-right text-base tabular-nums"
                />
                <span className="text-base text-neutral-600">{stockText}</span>
              </div>
              <button
                type="button"
                disabled={!packReady}
                onClick={() => onNewPack({ packagingUnit: packCode, packagingSize: size })}
                className="h-11 self-start rounded-md bg-primary-600 px-4 text-base font-semibold text-white disabled:opacity-50"
              >
                Use this pack
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------------------------- reason

/**
 * Quick mode's stock-out reason: "Add a reason", or "Reason: Expired ✕" - big enough for a glove.
 * Open, the reasons are a two-column grid of buttons; one tap picks and closes.
 */
function QuickReason({ value, onChange }: { value: OutReason | null; onChange: (reason: OutReason | null) => void }) {
  const [open, setOpen] = useState(false)
  if (open) {
    return (
      <div role="group" aria-label="Why is it going out?" className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          {OUT_REASONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={value === option.value}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={`h-12 rounded-md border-2 px-2 text-base font-medium ${
                value === option.value ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-neutral-200 text-neutral-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setOpen(false)} className="h-11 min-w-11 self-start rounded-md px-2 text-base font-medium text-primary-700">
          Close
        </button>
      </div>
    )
  }
  if (value == null) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-11 min-w-11 self-start rounded-md px-2 text-base font-medium text-primary-700 hover:bg-primary-50">
        Add a reason
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1 self-start rounded-full border-2 border-primary-200 bg-primary-50 pl-3">
      <button type="button" onClick={() => setOpen(true)} className="h-11 text-base font-medium text-primary-800">
        Reason: {outReasonLabel(value)}
      </button>
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-label="Remove the reason"
        className="flex h-11 w-11 items-center justify-center rounded-full text-primary-800 hover:bg-primary-100"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  )
}

// -------------------------------------------------------------------------------------- stamp

function StampFlash({ kind, text, next }: { kind: StampKind; text: string; next: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-4 rounded-lg border-2 border-neutral-200 px-4 py-10 text-center">
      <div className="scale-150">
        <Stamp kind={kind} land />
      </div>
      <p className="text-lg font-semibold tabular-nums">{text}</p>
      <p className="text-sm text-neutral-500">{kind === 'synced' ? 'Recorded.' : 'Saved on this phone.'} {next}</p>
    </div>
  )
}

// ------------------------------------------------------------------------------------ session

function SessionList({ entries, onUndone }: { entries: SessionEntry[]; onUndone: (key: string) => void }) {
  const { ops, recentlySent } = useOutboxState()
  const [error, setError] = useState<string | null>(null)
  if (entries.length === 0) return null

  function opStamp(opId: string | undefined, movementId: string | undefined): StampKind {
    if (movementId) return 'synced'
    const waiting = ops.find((op) => op.id === opId)
    if (waiting) return waiting.status === 'needs_attention' ? 'check' : 'recorded'
    return recentlySent.some((op) => op.id === opId) ? 'synced' : 'recorded'
  }

  function stampFor(entry: SessionEntry): StampKind {
    if (entry.sale) {
      // The sale as a whole: CHECK if any line needs looking at, RECORDED while any waits.
      const stamps = entry.sale.lines.filter((l) => l.status !== 'refused').map((l) => opStamp(l.opId, l.movementId))
      return stamps.includes('check') ? 'check' : stamps.includes('recorded') ? 'recorded' : 'synced'
    }
    if (entry.movementId || entry.moveId) return 'synced'
    // An ask (or an answer) that reached the server has no op to watch: it's synced, as its stamp said.
    if ((entry.mode === 'ask' || entry.mode === 'move') && !entry.opId) return 'synced'
    const waiting = ops.find((op) => op.id === entry.opId)
    if (waiting) return waiting.status === 'needs_attention' ? 'check' : 'recorded'
    return recentlySent.some((op) => op.id === entry.opId) ? 'synced' : 'recorded'
  }

  async function undo(entry: SessionEntry) {
    setError(null)
    try {
      if (entry.sale) {
        const problems = await undoSale(entry.sale)
        if (problems.length > 0) throw new Error(`Some of it couldn't be undone. ${problems.join(' ')}`)
      } else if (entry.mode === 'ask') {
        // An ask (Part 5): still on this phone, dropped; sent, taken back - the Store isn't asked any more.
        if (entry.opId && !isInFlight(entry.opId) && getOutboxState().ops.some((op) => op.id === entry.opId)) {
          await discardOp(entry.opId)
        } else {
          await requestsApi.cancel(entry.key)
        }
      } else if (entry.moveId) {
        applyMoveResult(await movesApi.undo(entry.moveId))
      } else if (entry.movementId) {
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
                {entry.areaName ? ` · ${entry.areaName}` : ''}
              </span>
              {/* An ask: tell the Store's people on WhatsApp, right here (its stamp only shows for a moment). */}
              {entry.share && !entry.undone && <WhatsAppTell share={entry.share} />}
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
