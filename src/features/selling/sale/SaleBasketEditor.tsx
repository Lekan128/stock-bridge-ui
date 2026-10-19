import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, Search } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { useProductFinder } from '@/features/catalog/useProductFinder'
import { usePendingStock } from '@/features/outbox/useOutbox'
import { productsApi } from '@/features/products/api/productsApi'
import { UnitToggle } from '@/features/products/components/UnitToggle'
import type { Product } from '@/features/products/types'
import { formatNumber, stockUnitWord, unitNoun } from '@/features/products/unitCopy'
import { resolveUnitSymbol, toBaseQuantity } from '@/features/products/unitSet'
import { formatMoney } from '@/features/selling/money'
import {
  belowUsual,
  lineAmount,
  optionOf,
  priceEach,
  quantityText,
  unitsFor,
  usualPrice,
  type SaleLine,
} from '@/features/selling/sale/saleLine'
import type { RecordedSale, useSaleBasket } from '@/features/selling/sale/useSaleBasket'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

type Basket = ReturnType<typeof useSaleBasket>

export interface SaleBasketEditorProps {
  basket: Basket
  /** Called once the lines have been recorded (or refused) - the caller shows the receipt or stamp. */
  onRecorded: (sale: RecordedSale) => void
  /** A product to start with - the product page's Sell button. Added once. */
  startProduct?: Product | null
}

/**
 * The basket itself (`SELLING_PRICE_PLAN.md` §6.1), shared by Record a sale and quick mode's Sell:
 * scan or search to add, one row a line until tapped open, one button to record it all. Shaped like
 * a till slip; nothing about cost or profit on it, ever (plan principle 11).
 */
export function SaleBasketEditor({ basket, onRecorded, startProduct }: SaleBasketEditorProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const online = useOnlineStatus()
  const canManageProducts = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_PRODUCTS)

  const [term, setTerm] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [askUnpriced, setAskUnpriced] = useState(false)
  const [recording, setRecording] = useState(false)
  const [makeUsual, setMakeUsual] = useState<Set<string>>(new Set())
  const searchRef = useRef<HTMLInputElement>(null)

  function addProduct(product: Product) {
    const key = basket.add(product)
    setOpenKey(key)
    setTerm('')
    setAskUnpriced(false)
    searchRef.current?.focus()
  }
  const finder = useProductFinder(term, addProduct)

  const started = useRef(false)
  useEffect(() => {
    if (!startProduct || started.current) return
    started.current = true
    if (basket.lines.some((line) => line.product.id === startProduct.id)) return
    addProduct(startProduct)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startProduct])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const itemCount = basket.lines.length
  const unpriced = basket.lines.filter((line) => lineAmount(line, optionOf(line, unitsFor(line.product, basket.catalogue))) == null)

  async function record() {
    if (unpriced.length > 0 && !askUnpriced) {
      setAskUnpriced(true)
      return
    }
    setRecording(true)
    setAskUnpriced(false)
    const usualToSet = basket.lines.filter((line) => makeUsual.has(line.key))
    const sale = await basket.record()
    setRecording(false)
    setOpenKey(null)
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
            if (event.key === 'Escape') setOpenKey(null)
          }}
          placeholder="Scan or search a product…"
          className="h-12 w-full rounded-lg border-2 border-neutral-300 bg-white pr-3 pl-11 text-base text-neutral-900 placeholder:text-neutral-500 focus:border-primary-600 focus:outline-none"
        />
      </div>

      {finder.search && (
        <div className="flex flex-col gap-1">
          {finder.results.map((product) => (
            <FoundProduct key={product.id} product={product} catalogue={basket.catalogue} onPick={addProduct} />
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

      {itemCount === 0 && !finder.search && (
        <p className="rounded-lg border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-600">
          Scan or search to add the first item.
        </p>
      )}

      {itemCount > 0 && (
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white" aria-label="This sale">
          {basket.lines.map((line) => (
            <BasketLine
              key={line.key}
              line={line}
              open={openKey === line.key}
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
              onOpen={() => setOpenKey(openKey === line.key ? null : line.key)}
              onChange={(patch) => {
                basket.update(line.key, patch)
                setAskUnpriced(false)
              }}
              onRemove={() => {
                const removed = basket.remove(line.key)
                setOpenKey(null)
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

      {itemCount > 0 &&
        (noteOpen || basket.note ? (
          <TextField
            id="sale-note"
            label="Note (optional)"
            hint="A customer's name, a receipt number."
            value={basket.note}
            onChange={(event) => basket.setNote(event.target.value)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="self-start rounded-sm text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Add a note
          </button>
        ))}

      {itemCount > 0 && (
        <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-neutral-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:mx-0 sm:rounded-b-lg">
          {askUnpriced && (
            <p role="alert" className="text-sm text-neutral-800">
              {unpriced.length === 1 ? `${unpriced[0].product.name} has no price.` : `${unpriced.length} items have no price.`} Record{' '}
              {unpriced.length === 1 ? 'it' : 'them'} without one, or tap {unpriced.length === 1 ? 'it' : 'them'} to add a price.
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-neutral-600" aria-live="polite">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}, {formatMoney(basket.total)}
            </p>
            <Button variant="action" onClick={() => void record()} loading={recording} className="min-h-12 px-5 text-base">
              {askUnpriced ? 'Record without a price' : `Record sale ${formatMoney(basket.total)}`}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

// ------------------------------------------------------------------------------- search row

function FoundProduct({ product, catalogue, onPick }: { product: Product; catalogue: ReturnType<typeof useSaleBasket>['catalogue']; onPick: (product: Product) => void }) {
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
          {formatNumber(product.quantityOnHand)} {stockUnitWord(unit, product.quantityOnHand)} on record
        </span>
      </span>
      <span className="shrink-0 text-right text-base font-semibold tabular-nums text-neutral-900">
        {price != null && opening ? `${formatMoney(price)} / ${opening.isStockUnit ? unit : unitNoun(opening)}` : <span className="text-sm font-normal text-neutral-500">No price</span>}
      </span>
    </button>
  )
}

// -------------------------------------------------------------------------------- one line

interface BasketLineProps {
  line: SaleLine
  open: boolean
  catalogue: ReturnType<typeof useSaleBasket>['catalogue']
  canMakeUsual: boolean
  makeUsual: boolean
  onMakeUsual: (on: boolean) => void
  onOpen: () => void
  onChange: (patch: Partial<SaleLine>) => void
  onRemove: () => void
}

function BasketLine({ line, open, catalogue, canMakeUsual, makeUsual, onMakeUsual, onOpen, onChange, onRemove }: BasketLineProps) {
  const options = unitsFor(line.product, catalogue)
  const option = optionOf(line, options)
  const each = priceEach(line, option)
  const amount = lineAmount(line, option)
  const usual = belowUsual(line, option)
  const noun = option.isStockUnit ? resolveUnitSymbol(line.product.unitOfMeasure, catalogue) : unitNoun(option)
  const pending = usePendingStock(line.product.id)
  const onRecord = line.product.quantityOnHand + pending.delta
  const base = toBaseQuantity(line.quantity, option)
  const short = base > onRecord
  const [priceMode, setPriceMode] = useState<'each' | 'total'>(line.totalTyped != null ? 'total' : 'each')
  // The box can be emptied to type a new number; a blank or 0 snaps back to the line's quantity.
  const [qtyText, setQtyText] = useState<string | null>(null)
  const priceId = `sale-price-${line.key}`
  const summary = quantityText(line, catalogue)

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-neutral-900">{line.product.name}</span>
          <span className="block text-sm text-neutral-600 tabular-nums">
            {summary}
            {each != null && ` × ${formatMoney(each)}`}
            {usual != null && <span className="text-neutral-500"> (usual {formatMoney(usual)})</span>}
          </span>
          {line.problem && (
            <span role="alert" className="mt-0.5 block text-xs font-medium text-danger-700">
              Not recorded: {line.problem}
            </span>
          )}
          {short && (
            <span className="mt-0.5 block text-xs font-medium text-warning-700">
              Only {formatNumber(onRecord)} {stockUnitWord(resolveUnitSymbol(line.product.unitOfMeasure, catalogue), onRecord)} on record
            </span>
          )}
        </span>
        <span className="shrink-0 text-base font-semibold tabular-nums text-neutral-900">
          {amount != null ? formatMoney(amount) : <span className="text-sm font-medium text-primary-700">Add price</span>}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-neutral-100 bg-neutral-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label={`Fewer ${line.product.name}`}
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
              How many {line.product.name}
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
              className="h-11 w-16 rounded-md border border-neutral-300 bg-white text-center text-base tabular-nums"
            />
            <button
              type="button"
              aria-label={`More ${line.product.name}`}
              onClick={() => {
                setQtyText(null)
                onChange({ quantity: line.quantity + 1 })
              }}
              className="flex h-11 w-11 items-center justify-center rounded-md border border-neutral-300 bg-white"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
            <UnitToggle
              value={option.label}
              options={options}
              onChange={(next) => onChange({ unitLabel: next.label, priceTyped: null, totalTyped: null })}
              label="Counted in"
            />
          </div>

          <div role="group" aria-label="Price" className="flex gap-1 self-start rounded-md border border-neutral-200 bg-white p-0.5">
            {(['each', 'total'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={priceMode === mode}
                onClick={() => {
                  setPriceMode(mode)
                  onChange(mode === 'each' ? { totalTyped: null } : { priceTyped: null })
                }}
                className={`rounded-sm px-3 py-1.5 text-sm font-medium ${priceMode === mode ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600'}`}
              >
                {mode === 'each' ? 'Price each' : 'Line total'}
              </button>
            ))}
          </div>
          {priceMode === 'each' ? (
            <TextField
              id={priceId}
              label={`Price each (₦ per ${noun})`}
              inputMode="decimal"
              value={line.priceTyped ?? (usualPrice(line.product, option) != null ? String(usualPrice(line.product, option)) : '')}
              onChange={(event) => onChange({ priceTyped: event.target.value })}
            />
          ) : (
            <TextField
              id={priceId}
              label={`What all ${formatNumber(line.quantity)} came to (₦)`}
              inputMode="decimal"
              value={line.totalTyped ?? ''}
              onChange={(event) => onChange({ totalTyped: event.target.value })}
            />
          )}
          {canMakeUsual && (line.priceTyped || line.totalTyped) && (
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
          <button
            type="button"
            onClick={onRemove}
            className="self-start rounded-sm text-sm font-medium text-danger-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Remove
          </button>
        </div>
      )}
    </li>
  )
}
