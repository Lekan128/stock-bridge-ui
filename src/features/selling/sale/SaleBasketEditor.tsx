import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, Search, X } from 'lucide-react'
import { api } from '@/api/client'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { useToast } from '@/components/useToast'
import { useApiQuery } from '@/data/useApiQuery'
import { useProductFinder } from '@/features/catalog/useProductFinder'
import { usePendingStock } from '@/features/outbox/useOutbox'
import { productsApi } from '@/features/products/api/productsApi'
import { UnitToggle } from '@/features/products/components/UnitToggle'
import type { Product } from '@/features/products/types'
import { formatNumber, stockUnitWord, unitNoun } from '@/features/products/unitCopy'
import { resolveUnitSymbol, toBaseQuantity } from '@/features/products/unitSet'
import { formatMoney } from '@/features/selling/money'
import { PaymentButtons, type SalePaymentMethod } from '@/features/selling/sale/payment'
import { belowUsual, lineAmount, openingUnit, optionOf, priceEach, unitsFor, usualPrice, type SaleLine } from '@/features/selling/sale/saleLine'
import type { RecordedSale, useSaleBasket } from '@/features/selling/sale/useSaleBasket'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { placeFigure } from '@/features/branches/areas'
import { useSheetArea } from '@/features/branches/useSheetBranch'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'

type Basket = ReturnType<typeof useSaleBasket>

export interface SaleBasketEditorProps {
  basket: Basket
  /** Called once the lines have been recorded (or refused) - the caller says so and offers the receipt. */
  onRecorded: (sale: RecordedSale) => void
  /** A product to start with - the product page's Sell button. Added once. */
  startProduct?: Product | null
  /**
   * Where the sale comes from when the screen already says (quick mode's title, owner 2026-10-31): the basket
   * then asks nothing. `null`: no area at this branch. Absent: the basket asks "Which area?" itself.
   */
  areaId?: string | null
  /** Above the search: the "Paid" line after a sale, on Record a sale. */
  banner?: ReactNode
}

/** A keyboard-and-mouse screen, where focusing the search costs nothing; on a phone it would pop the keyboard up. */
const finePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches

/**
 * The basket itself (`SELLING_PRICE_PLAN.md` §6.1; selling till Step 1 and its fixes), shared by Record a
 * sale and quick mode's Sell: tap a picture, scan or search to add; each line carries its own − and +, its
 * price (tap it to change it) and ✕; one tap on Cash, Transfer or Card records it all. Several baskets can
 * be open - "+ New sale" while a customer finds their money. Nothing about cost or profit on it, ever.
 */
export function SaleBasketEditor({ basket, onRecorded, startProduct, areaId, banner }: SaleBasketEditorProps) {
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

  function addProduct(product: Product, fromSearch = true) {
    basket.add(product)
    setTerm('')
    setAskUnpriced(false)
    // A scanner or a keyboard goes on to the next item; on a phone the keyboard goes down to show the basket.
    if (fromSearch && finePointer) searchRef.current?.focus()
    else if (fromSearch) searchRef.current?.blur()
  }
  const finder = useProductFinder(term, (product) => addProduct(product))
  // Where in the branch this sale comes from, at a branch with a choice of areas (V60): the Bar, not the Store.
  const branchHere = useOptionalWorkingBranch()
  const area = useSheetArea(branchHere && !branchHere.isAll ? branchHere.working : null)
  // Whose figures the search and the lines show: the till's area, else the branch's (sheets plan Part 4).
  const place = {
    branchId: branchHere && !branchHere.isAll ? branchHere.working?.id : undefined,
    areaId: areaId !== undefined ? (areaId ?? undefined) : area.areaId,
  }

  const started = useRef(false)
  useEffect(() => {
    if (!startProduct || started.current) return
    started.current = true
    if (basket.lines.some((line) => line.product.id === startProduct.id)) return
    addProduct(startProduct, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startProduct])

  useEffect(() => {
    if (finePointer) searchRef.current?.focus()
  }, [])

  const itemCount = basket.lines.length
  const unpriced = basket.lines.filter((line) => {
    const options = unitsFor(line.product, basket.catalogue)
    return lineAmount(line, optionOf(line, options), options) == null
  })
  const typing = term.trim() !== ''
  const waiting = basket.baskets.filter((b) => b.id !== basket.activeId && b.lines.length > 0)

  /** One tap on Cash, Transfer or Card records the whole sale, paid that way (selling till Step 1). */
  async function record(paymentMethod: SalePaymentMethod) {
    if (unpriced.length > 0 && !askUnpriced) {
      setAskUnpriced(true)
      return
    }
    setRecording(paymentMethod)
    setAskUnpriced(false)
    const usualToSet = basket.lines.filter((line) => makeUsual.has(line.key))
    const sale = await basket.record(areaId !== undefined ? (areaId ?? undefined) : area.areaId, paymentMethod)
    // The screen chose the area (quick mode): it remembers it, not the basket's own question.
    if (areaId === undefined) area.remember()
    setRecording(null)
    setMakeUsual(new Set())
    setNoteOpen(false)
    onRecorded(sale)
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

  return (
    <>
      {areaId === undefined && area.field}

      {/* Several customers at once: the waiting ones as amber pills with their totals (Step 1 fixes). */}
      {(waiting.length > 0 || itemCount > 0) && (
        <div role="group" aria-label="Sales on this phone" className="flex flex-wrap items-center gap-2">
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
                  className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-semibold tabular-nums ${
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
              className="inline-flex min-h-11 items-center rounded-full border border-dashed border-primary-400 px-3.5 text-sm font-semibold text-primary-700 hover:bg-primary-50"
            >
              + New sale
            </button>
          )}
        </div>
      )}

      {banner}

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
          className="h-12 w-full rounded-lg border-2 border-neutral-300 bg-white pr-3 pl-11 text-base text-neutral-900 placeholder:text-neutral-500 focus:border-primary-600 focus:outline-none"
        />
      </div>

      {finder.search && (
        <div className="flex flex-col gap-1">
          {finder.results.map((product) => (
            <FoundProduct key={product.id} product={product} place={place} catalogue={basket.catalogue} onPick={(p) => addProduct(p)} />
          ))}
          {finder.answered && finder.results.length === 0 && (
            <p className="px-1 text-sm text-neutral-600">
              Nothing matches “{finder.search}”.{' '}
              {online && canManageProducts ? (
                // The basket is kept as a draft, so going to add the product loses nothing (Pattern A).
                <Link to="/app/products/new" className="font-medium text-primary-600 hover:underline">
                  Add it as a new product
                </Link>
              ) : !online ? (
                'Not on this phone. Add it when you are back online.'
              ) : null}
            </p>
          )}
        </div>
      )}

      {itemCount === 0 && !typing && <p className="text-sm text-neutral-600">Tap a product, or scan or search to add it.</p>}

      {itemCount > 0 && !typing && (
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white" aria-label="This sale">
          {basket.lines.map((line) => (
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

      {!typing && <SaleTiles basket={basket} onPick={(product) => addProduct(product, false)} />}

      {itemCount > 0 &&
        !typing &&
        (noteOpen || basket.note ? (
          <div className="flex flex-col gap-1">
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
        ) : (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="-my-2 inline-flex min-h-11 items-center self-start rounded-sm text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Add a note
          </button>
        ))}

      {/* While someone types, the pay buttons step aside, so the keyboard never pushes them over the results. */}
      {itemCount > 0 && !typing && (
        <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-neutral-200 bg-white px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:mx-0 sm:rounded-b-lg">
          {askUnpriced && (
            <p role="alert" className="text-sm text-neutral-800">
              {unpriced.length === 1 ? `${unpriced[0].product.name} has no price.` : `${unpriced.length} items have no price.`} Tap “Add
              price” on {unpriced.length === 1 ? 'it' : 'them'}, or tap how they paid again to record without one.
            </p>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-neutral-600">
              {itemCount} {itemCount === 1 ? 'item' : 'items'} · collect
            </p>
            <p className="text-2xl font-semibold text-neutral-900 tabular-nums" aria-live="polite">
              {formatMoney(basket.total)}
            </p>
          </div>
          <PaymentButtons label={`Collect ${formatMoney(basket.total)} by`} busy={recording} onPick={(method) => void record(method)} />
        </div>
      )}
    </>
  )
}

// ----------------------------------------------------------------------------------- tiles

const TILE_COLOURS = ['bg-[#b42318]', 'bg-[#7a4b16]', 'bg-[#1d6fb8]', 'bg-[#2f6b2f]', 'bg-[#6b3fa0]', 'bg-[#0f766e]', 'bg-[#9a3412]', 'bg-[#3f3f46]']

function initials(name: string): string {
  const words = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase()
}

function colourOf(id: string): string {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return TILE_COLOURS[Math.abs(hash) % TILE_COLOURS.length]
}

/**
 * "Tap to add" (Step 1 fixes): the products this company sells most, then its other priced ones - so
 * nobody has to know to search. Kept from the last time it loaded, so it works offline too.
 */
function SaleTiles({ basket, onPick }: { basket: Basket; onPick: (product: Product) => void }) {
  const { user } = useAuth()
  const { data } = useApiQuery<Product[]>({
    queryKey: ['sale-tiles', user?.type === 'tenant' ? user.id : null],
    queryFn: () => api.get<Product[]>('/api/sales/tiles', { params: { limit: 12 } }).then((r) => r.data),
    fallbackError: "Couldn't load the products to tap.",
    enabled: user?.type === 'tenant',
  })
  if (!data || data.length === 0) return null
  return (
    <section aria-label="Tap to add" className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">Tap to add</h2>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {data.map((product) => {
          const opening = openingUnit(product, unitsFor(product, basket.catalogue))
          const price = usualPrice(product, opening)
          const inBasket = basket.lines.filter((line) => line.product.id === product.id).reduce((sum, line) => sum + line.quantity, 0)
          return (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => onPick(product)}
                aria-label={`Add ${product.name}${inBasket > 0 ? `, ${inBasket} in the sale` : ''}`}
                className="relative flex w-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white text-left hover:border-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 active:scale-[0.98]"
              >
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt="" className="h-14 w-full object-cover" loading="lazy" />
                ) : (
                  <span aria-hidden="true" className={`flex h-14 w-full items-center justify-center text-lg font-bold text-white ${colourOf(product.id)}`}>
                    {initials(product.name)}
                  </span>
                )}
                <span className="flex flex-col px-2 pt-1 pb-1.5">
                  <span className="line-clamp-2 text-sm leading-tight font-medium text-neutral-900">{product.name}</span>
                  <span className="text-xs text-neutral-600 tabular-nums">{price != null ? formatMoney(price) : 'No price'}</span>
                </span>
                {inBasket > 0 && (
                  <span aria-hidden="true" className="absolute top-1 right-1 min-w-6 rounded-full bg-action px-1.5 text-center text-xs leading-6 font-bold text-white tabular-nums">
                    {formatNumber(inBasket)}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ------------------------------------------------------------------------------- search row

function FoundProduct({ product, place, catalogue, onPick }: { product: Product; place: Place; catalogue: ReturnType<typeof useSaleBasket>['catalogue']; onPick: (product: Product) => void }) {
  const here = placeFigure(product, place).quantity
  const options = unitsFor(product, catalogue)
  const opening = options.find((option) => !option.isStockUnit && option.code === product.unitPriceEnteredUnit) ?? options.find((o) => o.isStockUnit)
  const price = opening ? usualPrice(product, opening) : null
  const unit = resolveUnitSymbol(product.unitOfMeasure, catalogue)
  return (
    <button
      type="button"
      onClick={() => onPick(product)}
      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-left hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <span className="min-w-0">
        <span className="block truncate text-base font-medium text-neutral-900">{product.name}</span>
        <span className="block text-sm text-neutral-500 tabular-nums">
          {formatNumber(here)} {stockUnitWord(unit, here)} in stock
        </span>
      </span>
      <span className="shrink-0 text-right text-base font-semibold tabular-nums text-neutral-900">
        {price != null && opening ? `${formatMoney(price)} / ${opening.isStockUnit ? unit : unitNoun(opening)}` : <span className="text-sm font-normal text-neutral-500">No price</span>}
      </span>
    </button>
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

/**
 * One line, everything in it (owner, 2026-11-16): − and + for how many, the price - tap it to change it, in
 * the same spot - and ✕. Nothing to open.
 */
function BasketLine({ line, place, catalogue, canMakeUsual, makeUsual, onMakeUsual, onChange, onRemove }: BasketLineProps) {
  const options = unitsFor(line.product, catalogue)
  const option = optionOf(line, options)
  const each = priceEach(line, option)
  const amount = lineAmount(line, option, options)
  const usual = belowUsual(line, option) ?? (line.priceTyped != null ? usualPrice(line.product, option) : null)
  const pending = usePendingStock(line.product.id, place.areaId)
  const onRecord = placeFigure(line.product, place).quantity + pending.delta
  const base = toBaseQuantity(line.quantity, option)
  const short = base > onRecord
  const [editingPrice, setEditingPrice] = useState(false)
  // The box can be emptied to type a new number; a blank or 0 snaps back to the line's quantity.
  const [qtyText, setQtyText] = useState<string | null>(null)
  const name = line.product.name
  const showUsual = usual != null && each != null && Math.abs(usual - each) >= 0.005

  return (
    <li className="flex flex-col gap-1.5 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-base font-medium text-neutral-900">{name}</span>
        <span className="shrink-0 text-base font-semibold tabular-nums text-neutral-900">{amount != null ? formatMoney(amount) : ''}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-label={`Fewer ${name}`}
          disabled={line.quantity <= 1}
          onClick={() => {
            setQtyText(null)
            onChange({ quantity: line.quantity - 1 })
          }}
          className="flex h-11 w-11 items-center justify-center rounded-md border border-neutral-300 bg-white disabled:opacity-40"
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
          className="h-11 w-12 rounded-md border border-neutral-300 bg-white text-center text-base tabular-nums"
        />
        <button
          type="button"
          aria-label={`More ${name}`}
          onClick={() => {
            setQtyText(null)
            onChange({ quantity: line.quantity + 1 })
          }}
          className="flex h-11 w-11 items-center justify-center rounded-md border border-neutral-300 bg-white"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        {options.length > 1 && (
          <UnitToggle
            value={option.label}
            options={options}
            onChange={(next) => onChange({ unitLabel: next.label, priceTyped: null, totalTyped: null })}
            label="Counted in"
          />
        )}

        <span className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 text-sm text-neutral-600 tabular-nums">
          <span aria-hidden="true">×</span>
          {editingPrice ? (
            <>
              <label htmlFor={`sale-price-${line.key}`} className="sr-only">
                Price each (₦) for {name}
              </label>
              <input
                id={`sale-price-${line.key}`}
                autoFocus
                inputMode="decimal"
                value={line.priceTyped ?? (usualPrice(line.product, option) != null ? String(usualPrice(line.product, option)) : '')}
                onChange={(event) => onChange({ priceTyped: event.target.value, totalTyped: null })}
                onBlur={() => setEditingPrice(false)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') setEditingPrice(false)
                }}
                className="h-10 w-24 rounded-md border-2 border-primary-600 bg-white px-2 text-base font-semibold text-neutral-900 tabular-nums"
              />
            </>
          ) : (
            <button
              type="button"
              aria-label={each != null ? `Change price of ${name}, ${formatMoney(each)} each` : `Add a price for ${name}`}
              onClick={() => setEditingPrice(true)}
              className="-my-2 inline-flex min-h-11 items-center font-semibold text-primary-700 underline decoration-dashed decoration-2 underline-offset-4"
            >
              {each != null ? formatMoney(each) : 'Add price'}
            </button>
          )}
          {showUsual && <span className="text-xs text-neutral-500">usual {formatMoney(usual)}</span>}
        </span>

        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="flex h-11 w-11 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-600 hover:text-danger-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {canMakeUsual && line.priceTyped && (
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
