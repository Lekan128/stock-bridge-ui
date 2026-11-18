import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/Button'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowLeft, Minus, Plus, Search, X } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { useToast } from '@/components/useToast'
import { useProductFinder } from '@/features/catalog/useProductFinder'
import { usePendingStock } from '@/features/outbox/useOutbox'
import { productsApi } from '@/features/products/api/productsApi'
import type { Product } from '@/features/products/types'
import { formatNumber, stockUnitWord } from '@/features/products/unitCopy'
import { resolveUnitSymbol, toBaseQuantity } from '@/features/products/unitSet'
import { formatMoney } from '@/features/selling/money'
import { PaymentButtons, type SalePaymentMethod } from '@/features/selling/sale/payment'
import { SaleProductGrid } from '@/features/selling/sale/SaleProductGrid'
import { lineAmount, optionOf, priceEach, unitsFor, usualPrice, type SaleLine } from '@/features/selling/sale/saleLine'
import type { RecordedSale, useSaleBasket } from '@/features/selling/sale/useSaleBasket'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { placeFigure } from '@/features/branches/areas'
import { useSheetArea } from '@/features/branches/useSheetBranch'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { TransferAccountChooser } from '@/features/selling/sale/TransferAccounts'
import { DrawerLine, StartDayBar, useCashTill } from '@/features/selling/sale/cashDay'
import { useQueryClient } from '@tanstack/react-query'

type Basket = ReturnType<typeof useSaleBasket>

export interface SaleBasketEditorProps {
  basket: Basket
  /** Called once the lines have been recorded (or refused) - the caller shows the receipt. */
  onRecorded: (sale: RecordedSale) => void
  /** A product to start with - the product page's Sell button. Added once. */
  startProduct?: Product | null
  /**
   * Where the sale comes from when the screen already says (quick mode's title, owner 2026-10-31): the basket
   * then asks nothing. `null`: no area at this branch. Absent: the basket asks "Which area?" itself.
   */
  areaId?: string | null
  /** Above the sale: what went wrong with the last one, on Record a sale. */
  banner?: ReactNode
  /** Record a sale on a wide screen: products on the left, the sale on the right, like a till. */
  wide?: boolean
  /** The till's own Back, on a wide screen (its top bar takes the page's place). */
  onBack?: () => void
  /** At the right of the till's top bar on a wide screen: "My sales today". */
  topRight?: ReactNode
}

/** A keyboard-and-mouse screen, where focusing the search costs nothing; on a phone it would pop the keyboard up. */
const finePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches

/**
 * The basket itself (`SELLING_PRICE_PLAN.md` §6.1; selling till Step 1, round 3), shared by Record a sale
 * and quick mode's Sell. Products are small buttons under category chips, and the search narrows those same
 * buttons; each line is one row (− n +, its total - tap to change the price - and ✕), newest at the top;
 * one tap on Cash, Transfer or Card records it all. Several baskets can be open ("+ New sale").
 * Nothing about cost or profit on it, ever.
 */
export function SaleBasketEditor({ basket, onRecorded, startProduct, areaId, banner, wide = false, onBack, topRight }: SaleBasketEditorProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const online = useOnlineStatus()
  const canManageProducts = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_PRODUCTS)

  const [term, setTerm] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [askUnpriced, setAskUnpriced] = useState(false)
  const [recording, setRecording] = useState<SalePaymentMethod | null>(null)
  const [makeUsual, setMakeUsual] = useState<Set<string>>(new Set())
  const searchRef = useRef<HTMLInputElement>(null)
  const [topbarSlot, setTopbarSlot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (wide) setTopbarSlot(document.getElementById('topbar-page-slot'))
  }, [wide])

  function addProduct(product: Product) {
    basket.add(product)
    // Searched for it: the search clears and stays ready for the next item (owner, 2026-11-16).
    if (term !== '') {
      setTerm('')
      searchRef.current?.focus()
    }
    setAskUnpriced(false)
  }
  // Where in the branch this sale comes from, at a branch with a choice of areas (V60): the Bar, not the Store.
  const branchHere = useOptionalWorkingBranch()
  const area = useSheetArea(branchHere && !branchHere.isAll ? branchHere.working : null, basket.waitingByArea)
  // Step 12: the transfer accounts of the branch selling (a one-branch company's only branch).
  const workingBranch = branchHere && !branchHere.isAll ? (branchHere.working ?? branchHere.branches[0] ?? null) : null
  const accounts = workingBranch?.paymentAccounts ?? []
  const [choosingAccount, setChoosingAccount] = useState(false)
  const queryClient = useQueryClient()
  // Step 13: the drawer this till sells into, while "Count cash at open and close" is on (nothing of it otherwise).
  const drawerAreaId = areaId !== undefined ? (areaId ?? undefined) : area.areaId
  const drawerPlace = workingBranch?.areas?.find((candidate) => candidate.id === drawerAreaId)?.name
  const cashTill = useCashTill(workingBranch?.id, drawerAreaId)
  const drawer = cashTill.data?.countsCash ? cashTill.data : null
  const needsStart = drawer != null && !drawer.open && !drawer.closedToday
  // Whose figures the lines show: the till's area, else the branch's (sheets plan Part 4).
  const place = {
    branchId: branchHere && !branchHere.isAll ? branchHere.working?.id : undefined,
    areaId: areaId !== undefined ? (areaId ?? undefined) : area.areaId,
  }
  // A sale stays with its area: switching areas shows that area's sales; this one waits (owner, 2026-11-18).
  const { showArea } = basket
  useEffect(() => showArea(place.areaId), [showArea, place.areaId])
  // The search finds what "All" shows: this area's priced products (owner, 2026-11-18).
  const finder = useProductFinder(term, addProduct, 30, true, { areaId: place.areaId })

  const started = useRef(false)
  useEffect(() => {
    if (!startProduct || started.current) return
    started.current = true
    if (basket.lines.some((line) => line.product.id === startProduct.id)) return
    basket.add(startProduct)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startProduct])

  useEffect(() => {
    if (finePointer) searchRef.current?.focus()
  }, [])

  const itemCount = basket.lines.length
  // "Cancel sale": asked in place, never a popup; a different sale on screen forgets the question.
  const [cancelling, setCancelling] = useState(false)
  useEffect(() => setCancelling(false), [basket.activeId])
  const unpriced = basket.lines.filter((line) => {
    const options = unitsFor(line.product, basket.catalogue)
    return lineAmount(line, optionOf(line, options), options) == null
  })
  const typing = term.trim() !== ''
  const waiting = basket.baskets.filter((b) => b.id !== basket.activeId && b.lines.length > 0)
  // Typing on a phone: the keyboard needs the room, so the sale steps aside; beside the products it stays.
  const hideSale = typing ? (wide ? 'hidden lg:flex' : 'hidden') : 'flex'

  /** One tap on Cash, Transfer or Card records the whole sale, paid that way (selling till Step 1). */
  async function record(paymentMethod: SalePaymentMethod, accountId?: string) {
    if (unpriced.length > 0 && !askUnpriced) {
      setAskUnpriced(true)
      return
    }
    // Step 12: a transfer names its account - the only one, or, with two or more, the one the cashier picks.
    if (paymentMethod === 'TRANSFER' && accountId === undefined && accounts.length > 0) {
      if (accounts.length === 1) return record('TRANSFER', accounts[0].id)
      setChoosingAccount(true)
      return
    }
    setChoosingAccount(false)
    setRecording(paymentMethod)
    setAskUnpriced(false)
    const usualToSet = basket.lines.filter((line) => makeUsual.has(line.key))
    const sale = await basket.record(areaId !== undefined ? (areaId ?? undefined) : area.areaId, paymentMethod, accountId)
    // The screen chose the area (quick mode): it remembers it, not the basket's own question.
    if (areaId === undefined) area.remember()
    setRecording(null)
    setMakeUsual(new Set())
    setNoteOpen(false)
    onRecorded(sale)
    // A cash sale can reopen a drawer closed earlier today (Step 13).
    if (drawer) void queryClient.invalidateQueries({ queryKey: ['cash-till'] })
    // "Make this the usual price", for lines that were recorded - a product edit, so online only.
    for (const line of usualToSet) {
      if (!sale.lines.some((r) => r.line.key === line.key && r.status !== 'refused')) continue
      const option = optionOf(line, unitsFor(line.product, basket.catalogue))
      const each = priceEach(line, option)
      if (each == null) continue
      productsApi
        .update(line.product.id, { unitPrice: each, unitPriceUnit: option.isStockUnit ? undefined : option.code })
        .catch(() => showToast(`Couldn't make that ${line.product.name}'s usual price.`, 'error'))
    }
  }

  // On a wide screen (Record a sale, owner 2026-11-16): a till. A bar across the top with the sales on this
  // phone; products fill the left; the sale runs the full height of the right edge, total and pay at the bottom.
  const W = wide
  const cancelLink = (
    <button
      type="button"
      onClick={() => setCancelling(true)}
      className="inline-flex min-h-10 items-center rounded-lg px-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
    >
      Cancel sale
    </button>
  )
  const cancelQuestion = (
    <div role="group" aria-label="Cancel this sale?" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2">
      <p className="text-sm">
        <span className="font-semibold text-danger-800">Cancel this sale?</span>{' '}
        <span className="text-neutral-700 tabular-nums">
          {itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatMoney(basket.total)}
        </span>
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" autoFocus onClick={() => setCancelling(false)}>
          Keep it
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            basket.cancelSale()
            setTerm('')
            setAskUnpriced(false)
            setCancelling(false)
            showToast('Sale cancelled.', 'success')
          }}
        >
          Yes, cancel
        </Button>
      </div>
    </div>
  )
  const tabs = (
    <>
      {waiting.length > 0 &&
        basket.baskets.map((b, index) => {
          const isActive = b.id === basket.activeId
          if (!isActive && b.lines.length === 0) return null
          return (
            <button
              key={b.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => basket.switchTo(b.id)}
              className={`inline-flex min-h-10 shrink-0 items-center rounded-lg border px-2.5 text-sm font-semibold whitespace-nowrap tabular-nums ${
                isActive ? 'border-action bg-action text-white' : 'border-warning-300 bg-warning-50 text-warning-900'
              }`}
            >
              Sale {index + 1}
              {b.lines.length > 0 && ` · ${formatMoney(basket.totalOf(b))}`}
            </button>
          )
        })}
      {itemCount > 0 && (
        <button
          type="button"
          onClick={() => {
            basket.newSale()
            setTerm('')
            setAskUnpriced(false)
          }}
          className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-2.5 text-sm font-semibold whitespace-nowrap text-primary-700 hover:bg-primary-50"
        >
          + New sale
        </button>
      )}
    </>
  )

  // In the app's own top bar, which is otherwise empty on its left (owner, 2026-11-16) - no second bar.
  const topBar = W && topbarSlot && createPortal(
    <div className="flex min-w-0 items-center gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
      <h1 className="text-lg font-semibold whitespace-nowrap text-neutral-900">Record a sale</h1>
      {topRight && <div className="ml-4 shrink-0 whitespace-nowrap">{topRight}</div>}
    </div>,
    topbarSlot,
  )

  const search = (
    <div className={`flex flex-col gap-3 ${W ? 'lg:col-start-1 lg:row-start-1 lg:bg-neutral-50 lg:px-4 lg:pt-4' : ''}`}>
      {areaId === undefined && area.field}
      {needsStart && workingBranch && <StartDayBar branchId={workingBranch.id} areaId={drawerAreaId} placeName={drawerPlace} />}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
        <label htmlFor="sale-search" className="sr-only">
          Scan or search a product
        </label>
        <input
          ref={searchRef}
          id="sale-search"
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              finder.onEnter()
            }
            if (event.key === 'Escape') setTerm('')
          }}
          placeholder="Scan or search a product…"
          className="h-12 w-full rounded-lg border border-neutral-300 bg-white pr-3 pl-11 text-base text-neutral-900 placeholder:text-neutral-500 focus:border-primary-600 focus:ring-2 focus:ring-primary-100 focus:outline-none"
        />
      </div>
      {typing && finder.answered && finder.results.length === 0 && online && canManageProducts && (
        // The basket is kept as a draft, so going to add the product loses nothing (Pattern A).
        <Link to="/app/products/new" className="text-sm font-medium text-primary-600 hover:underline">
          Add “{finder.search}” as a new product
        </Link>
      )}
      {typing && finder.answered && finder.results.length === 0 && !online && (
        <p className="text-sm text-neutral-600">Not on this phone. Add it when you are back online.</p>
      )}
    </div>
  )

  const footer = (
    <div
      className={`sticky bottom-0 z-10 -mx-4 ${itemCount === 0 ? 'hidden lg:flex' : 'flex'} flex-col gap-1.5 border-t border-neutral-200 bg-white px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:mx-0 sm:rounded-b-lg ${
        W ? 'lg:static lg:mx-0 lg:gap-3 lg:rounded-none lg:px-4 lg:pt-3 lg:pb-4' : ''
      }`}
    >
      {askUnpriced && (
        <p role="alert" className="text-sm text-neutral-800">
          {unpriced.length === 1 ? `${unpriced[0].product.name} has no price.` : `${unpriced.length} items have no price.`} Tap “Add
          price” on {unpriced.length === 1 ? 'it' : 'them'}, or tap how they paid again to record without one.
        </p>
      )}
      <div className={`items-baseline justify-between gap-3 ${itemCount === 0 ? 'hidden' : 'flex'}`}>
        <p className="text-sm text-neutral-600">
          <span className={W ? 'lg:hidden' : ''}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
          {W && (
            <span className="hidden lg:inline">
              Total · {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          )}
        </p>
        <p className={`text-xl font-semibold text-neutral-900 tabular-nums ${W ? 'lg:text-3xl' : ''}`} aria-live="polite">
          {formatMoney(basket.total)}
        </p>
      </div>
      {itemCount === 0 && drawer && (drawer.open || drawer.closedToday) ? (
        <DrawerLine till={drawer} placeName={drawerPlace} />
      ) : (
      <div className={itemCount === 0 ? 'pointer-events-none opacity-35' : ''} aria-hidden={itemCount === 0 || undefined}>
        {/* Tapping one records it as paid that way (owner, 2026-11-18: a first-time cashier might not know) - said in one
            small line, not a step, so a phone and quick mode keep their room. */}
        {choosingAccount && workingBranch ? (
          <TransferAccountChooser
            branchId={workingBranch.id}
            accounts={accounts}
            amount={basket.total}
            busy={recording === 'TRANSFER'}
            onPick={(account) => void record('TRANSFER', account.id)}
            onBack={() => setChoosingAccount(false)}
          />
        ) : (
          <>
            <p className="mb-1 text-xs font-medium text-neutral-500" aria-hidden="true">
              Paid with
            </p>
            <PaymentButtons label={`Paid with, ${formatMoney(basket.total)}`} busy={recording} onPick={(method) => void record(method)} />
          </>
        )}
      </div>
      )}
    </div>
  )

  const sale = (
    <div
      className={`${hideSale} relative flex-col gap-2 ${
        W ? 'lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:min-h-0 lg:gap-0 lg:border-l lg:border-neutral-200 lg:bg-white' : ''
      }`}
    >
      {/* The sales on this phone and "+ New sale", in one line above the lines - on a wide screen at the top of the
          sale panel, not the app's top bar, which they crowded (owner, 2026-11-18). */}
      {(waiting.length > 0 || itemCount > 0) && (
        <div role="group" aria-label="Sales on this phone" className={`flex min-w-0 items-center justify-end gap-1.5 overflow-x-auto ${W ? 'lg:hidden' : ''}`}>
          {tabs}
        </div>
      )}
      {W && (
        <div className="hidden min-h-14 items-center gap-1.5 px-4 pt-3 pb-1 lg:flex">
          <h2 className={waiting.length > 0 ? 'sr-only' : 'text-base font-semibold text-neutral-900'}>
            {waiting.length > 0 ? `Sale ${basket.baskets.findIndex((b) => b.id === basket.activeId) + 1}` : 'Sale'}
          </h2>
          <div role="group" aria-label="Sales on this computer" className="flex min-w-0 flex-1 items-center justify-end gap-1.5 overflow-x-auto">
            {tabs}
          </div>
        </div>
      )}

      {banner && <div className={W ? 'lg:px-4 lg:pb-2' : ''}>{banner}</div>}

      <div className={W ? 'lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-4' : ''}>
        {itemCount === 0 ? (
          <>
            {/* The drawer between customers (Step 13); nothing at all otherwise - no "tap a product" line (owner, 2026-11-18). */}
            {drawer && <div className={W ? 'lg:hidden' : ''}><DrawerLine till={drawer} placeName={drawerPlace} /></div>}
            {W && (
              <div className="hidden h-full flex-col items-center justify-center gap-1 py-16 text-center lg:flex">
                <p className="text-sm font-semibold text-neutral-600">No items yet</p>
                <p className="text-sm text-neutral-500">Click a product, or scan or search.</p>
              </div>
            )}
          </>
        ) : (
          <ul
            className={`flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white ${W ? 'lg:-mx-3 lg:rounded-none lg:border-0' : ''}`}
            aria-label="This sale"
          >
            {/* Newest first: what was just added sits right under the search (owner, 2026-11-16). */}
            {[...basket.lines].reverse().map((line) => (
              <BasketLine
                key={line.key}
                line={line}
                place={place}
                catalogue={basket.catalogue}
                canMakeUsual={canManageProducts && online && line.product.unitPrice == null}
                makeUsual={makeUsual.has(line.key)}
                onMakeUsual={(on) =>
                  setMakeUsual((current) => {
                    const next = new Set(current)
                    if (on) next.add(line.key)
                    else next.delete(line.key)
                    return next
                  })
                }
                onChange={(patch) => {
                  basket.update(line.key, patch)
                  setAskUnpriced(false)
                }}
                onRemove={() => {
                  const removed = basket.remove(line.key)
                  if (removed) {
                    showToast(`${removed.product.name} taken off the sale.`, 'info', {
                      action: { label: 'Undo', onAction: () => basket.restore(removed) },
                    })
                  }
                }}
              />
            ))}
          </ul>
        )}

        {itemCount > 0 && cancelling && <div className="mt-2">{cancelQuestion}</div>}
        {itemCount > 0 && !cancelling && (noteOpen || basket.note) && (
            <div className="mt-2 flex flex-col gap-1">
              <label htmlFor="sale-note" className="text-sm font-medium text-neutral-800">
                Note (optional)
              </label>
              <input
                id="sale-note"
                value={basket.note}
                onChange={(event) => basket.setNote(event.target.value)}
                placeholder="A customer's name, a table"
                className="h-11 rounded-md border border-neutral-300 bg-white px-3 text-base"
              />
            </div>
        )}
        {/* "Add a note" and "Cancel sale" share the row under the lines (owner, 2026-11-18): out of the way of the sales. */}
        {itemCount > 0 && !cancelling && (
          <div className="flex items-center justify-between gap-3">
            {!(noteOpen || basket.note) && (
              <button
                type="button"
                onClick={() => setNoteOpen(true)}
                className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Add a note
              </button>
            )}
            <span className="-mr-2 ml-auto">{cancelLink}</span>
          </div>
        )}
      </div>

      {(itemCount > 0 || W) && footer}
    </div>
  )

  const products = (
    <div className={W ? 'lg:col-start-1 lg:row-start-2 lg:min-h-0 lg:overflow-y-auto lg:bg-neutral-50 lg:px-4 lg:pt-3 lg:pb-6' : ''}>
      <SaleProductGrid
        basket={basket}
        search={finder.search}
        searchResults={finder.results}
        searchAnswered={finder.answered}
        onPick={addProduct}
        areaId={place.areaId}
      />
    </div>
  )

  return (
    <div
      className={`flex flex-col gap-4 ${
        W ? 'lg:grid lg:h-full lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-0' : ''
      }`}
    >
      {topBar}
      {search}
      {sale}
      {products}
    </div>
  )
}

// -------------------------------------------------------------------------------- one line

/** Where the sale comes from, and so whose figures it shows. */
interface Place {
  branchId?: string
  areaId?: string
}

interface BasketLineProps {
  line: SaleLine
  place: Place
  catalogue: ReturnType<typeof useSaleBasket>['catalogue']
  canMakeUsual: boolean
  makeUsual: boolean
  onMakeUsual: (on: boolean) => void
  onChange: (patch: Partial<SaleLine>) => void
  onRemove: () => void
}

function money(value: number): string {
  return String(Math.round(value * 100) / 100)
}

/**
 * One line, one row (owner, 2026-11-16): the name with its price each, − n +, the line's total - tap it to
 * change the price, for one or for the whole line, in place - and ✕. A product sold in packs says which
 * ("bottle ▾") and can switch.
 */
function BasketLine({ line, place, catalogue, canMakeUsual, makeUsual, onMakeUsual, onChange, onRemove }: BasketLineProps) {
  const options = unitsFor(line.product, catalogue)
  const option = optionOf(line, options)
  const each = priceEach(line, option)
  const amount = lineAmount(line, option, options)
  const usual = usualPrice(line.product, option)
  const pending = usePendingStock(line.product.id, place.areaId)
  const onRecord = placeFigure(line.product, place).quantity + pending.delta
  const base = toBaseQuantity(line.quantity, option)
  // A made-here item (V90) has no stock to run short of.
  const short = !line.product.madeHere && base > onRecord
  const [editingPrice, setEditingPrice] = useState(false)
  // The box can be emptied to type a new number; a blank or 0 snaps back to the line's quantity.
  const [qtyText, setQtyText] = useState<string | null>(null)
  const name = line.product.name
  const changed = usual != null && each != null && Math.abs(usual - each) >= 0.005
  // "crate", not "crate of 12 pieces": the line's price must fit beside its ✕ (walk-through, 2026-11-17).
  const unitWord = option.isStockUnit ? null : option.label.split(' ')[0].toLowerCase()

  // The price each, on its own line under the row (never beside a unit menu or under the ✕, owner 2026-11-18) - and
  // only when it says something the total doesn't: more than one, a changed price, or no price yet. One at the usual
  // price is just its total, which opens the price too.
  const showEach = each == null || changed || line.quantity !== 1
  const priceButton = (
          <button
            type="button"
            aria-expanded={editingPrice}
            aria-label={amount != null ? `Change price of ${name}, ${formatMoney(amount)}` : `Add a price for ${name}`}
            onClick={() => setEditingPrice((open) => !open)}
            className={`-my-1 inline-flex min-h-11 min-w-0 items-center rounded px-1 text-left text-sm leading-tight tabular-nums hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:min-h-9 ${
              each == null ? 'font-semibold text-primary-700' : changed ? 'text-warning-800' : 'text-neutral-600'
            }`}
          >
            <span>
              {each != null ? `${formatMoney(each)} ${unitWord ? `a ${unitWord}` : 'each'}${changed && usual != null ? ` · usual ${formatMoney(usual)}` : ''}` : 'Add price'}
            </span>
          </button>
  )
  return (
    <li className={`flex min-w-0 flex-col gap-1.5 px-3 py-2.5 ${editingPrice ? 'bg-neutral-50' : ''}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-base font-medium text-neutral-900">{name}</p>
        {/* The line's total opens the price too, with Total ready to type - it's the number tapped (owner, 2026-11-17). */}
        {amount != null ? (
          <button
            type="button"
            aria-label={`Change the total for ${name}`}
            aria-expanded={editingPrice}
            onClick={() => {
              setEditingPrice(true)
              window.setTimeout(() => {
                const box = document.getElementById(`sale-total-${line.key}`) as HTMLInputElement | null
                box?.focus()
                box?.select()
              }, 0)
            }}
            className="shrink-0 rounded-sm text-base font-semibold text-neutral-900 tabular-nums underline decoration-neutral-300 decoration-dashed underline-offset-4 hover:decoration-neutral-500"
          >
            {formatMoney(amount)}
          </button>
        ) : (
          <span className="shrink-0" />
        )}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex shrink-0 items-center rounded-full bg-neutral-100">
          <button
            type="button"
            aria-label={`Fewer ${name}`}
            disabled={line.quantity <= 1}
            onClick={() => {
              setQtyText(null)
              onChange({ quantity: line.quantity - 1 })
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-800 hover:bg-neutral-200 disabled:opacity-30 lg:h-9 lg:w-9"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <label htmlFor={`sale-qty-${line.key}`} className="sr-only">
            How many {name}
          </label>
          <input
            id={`sale-qty-${line.key}`}
            inputMode="numeric"
            value={qtyText ?? String(line.quantity)}
            onChange={(event) => {
              setQtyText(event.target.value)
              const value = Math.floor(Number(event.target.value))
              if (event.target.value.trim() !== '' && Number.isFinite(value) && value >= 1) onChange({ quantity: value })
            }}
            onBlur={() => setQtyText(null)}
            className="h-9 w-9 rounded-md bg-transparent text-center text-base font-semibold text-neutral-900 tabular-nums focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="button"
            aria-label={`More ${name}`}
            onClick={() => {
              setQtyText(null)
              onChange({ quantity: line.quantity + 1 })
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-800 hover:bg-neutral-200 lg:h-9 lg:w-9"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {options.length > 1 && (
          <>
            <label htmlFor={`sale-unit-${line.key}`} className="sr-only">
              Unit for {name}
            </label>
            <select
              id={`sale-unit-${line.key}`}
              value={option.label}
              onChange={(event) => onChange({ unitLabel: event.target.value, priceTyped: null, totalTyped: null })}
              className="h-9 max-w-[8rem] shrink-0 rounded-md border border-neutral-200 bg-white px-1.5 text-sm text-neutral-800"
            >
              {options.map((choice) => (
                <option key={choice.label} value={choice.label}>
                  {choice.label}
                </option>
              ))}
            </select>
          </>
        )}
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="ml-auto flex h-11 w-9 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-danger-700 lg:h-9"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {showEach && <div className="-mt-1 pl-1">{priceButton}</div>}

      {editingPrice && (
        <div className="flex min-w-0 items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <label htmlFor={`sale-each-${line.key}`} className="text-xs font-medium text-neutral-600">
              Each (₦)
            </label>
            <input
              id={`sale-each-${line.key}`}
              autoFocus
              inputMode="decimal"
              value={line.priceTyped ?? (line.totalTyped == null && usual != null ? money(usual) : each != null ? money(each) : '')}
              onChange={(event) => onChange({ priceTyped: event.target.value, totalTyped: null })}
              className="h-10 w-full min-w-0 rounded-md border-2 border-neutral-300 bg-white px-2 text-base font-semibold tabular-nums focus:border-primary-600 focus:outline-none"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <label htmlFor={`sale-total-${line.key}`} className="text-xs font-medium text-neutral-600">
              Total (₦)
            </label>
            <input
              id={`sale-total-${line.key}`}
              inputMode="decimal"
              value={line.totalTyped ?? (amount != null ? money(amount) : '')}
              onChange={(event) => onChange({ totalTyped: event.target.value, priceTyped: null })}
              className="h-10 w-full min-w-0 rounded-md border-2 border-neutral-300 bg-white px-2 text-base font-semibold tabular-nums focus:border-primary-600 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setEditingPrice(false)}
            className="inline-flex min-h-10 items-center rounded-md px-2 text-sm font-semibold text-primary-700 hover:bg-primary-50"
          >
            Done
          </button>
        </div>
      )}
      {editingPrice && canMakeUsual && (line.priceTyped || line.totalTyped) && (
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={makeUsual}
            onChange={(event) => onMakeUsual(event.target.checked)}
            className="h-4 w-4 rounded text-primary-600 focus:ring-primary-500"
          />
          Make {each != null ? formatMoney(each) : 'this'} the usual price
        </label>
      )}
      {line.problem && (
        <p role="alert" className="text-xs font-medium text-danger-700">
          Not recorded: {line.problem}
        </p>
      )}
      {short && (
        <p className="text-xs font-medium text-warning-700">
          Only {formatNumber(onRecord)} {stockUnitWord(resolveUnitSymbol(line.product.unitOfMeasure, catalogue), onRecord)} in stock
        </p>
      )}
    </li>
  )
}
