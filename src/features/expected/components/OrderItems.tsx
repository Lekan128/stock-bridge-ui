import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Minus, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { expectedCopy } from '@/features/expected/copy'
import { formatQuantity, orderMoney, shortDate, unitChoiceWord } from '@/features/expected/expected'
import { PICKER_LIMIT, useProductSearch, useSuggestions } from '@/features/expected/hooks/useProductPicker'
import {
  amountOf,
  chosenOption,
  moneyText,
  groupByProduct,
  priceInvalid,
  priceOf,
  priceText,
  quantityInvalid,
  quantityOf,
  stepQuantity,
  usualOption,
  type OrderItem,
} from '@/features/expected/orderItems'
import type { PickerLine } from '@/features/expected/types'
import { quantityUnitWord } from '@/features/imports/delivery'

const text = expectedCopy.form

export interface OrderItemsProps {
  vendorId: string
  supplierName: string
  /** Where it is going: the stock figures beside each line are that branch's. */
  branchId: string
  items: OrderItem[]
  onAdd: (options: PickerLine[]) => void
  /** By the item's `key`. */
  onChange: (key: string, patch: Partial<Pick<OrderItem, 'unit' | 'quantity' | 'price'>>) => void
  onRemove: (key: string) => void
  /** The line just added: its quantity box takes the cursor. */
  focusProductId: string | null
  /** Changing this order: its own lines aren't "coming", and the word says "on other orders". */
  changingOrderId?: string
  disabled?: boolean
  /** A price per line (an order); off when asking suppliers for prices. */
  withPrices?: boolean
}

/**
 * "Items" (redesign 2026-11-04): one heading, one search, the lines under it, and — before anything
 * is typed — what is running low from this supplier. Each line shows what decides "how many?": what
 * is left here, whether that is low, and what is already coming on other orders.
 */
export function OrderItems(props: OrderItemsProps) {
  const { vendorId, supplierName, branchId, items, onAdd, onChange, onRemove, focusProductId, disabled, changingOrderId = '', withPrices = true } = props
  const changing = changingOrderId !== ''
  const [query, setQuery] = useState('')
  const typed = useDebouncedValue(query, 250)
  const search = useProductSearch(typed, vendorId, branchId, changingOrderId)
  const suggestions = useSuggestions(vendorId, branchId, changingOrderId)
  const inputRef = useRef<HTMLInputElement>(null)
  const searching = query.trim() !== ''
  const onOrder = new Set(items.map((item) => item.productId))
  const results = groupByProduct(search.lines ?? [])
  const suggested = groupByProduct(suggestions.lines).filter((group) => !onOrder.has(group[0].productId))

  function add(options: PickerLine[]) {
    onAdd(options)
    setQuery('')
  }

  return (
    <section aria-labelledby="po-items-heading" className="flex flex-col gap-3">
      <h2 id="po-items-heading" className="text-sm font-semibold text-neutral-900">
        {text.itemsHeading}
      </h2>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
        <label htmlFor="po-product-search" className="sr-only">
          {text.searchLabel}
        </label>
        <input
          ref={inputRef}
          id="po-product-search"
          type="search"
          value={query}
          disabled={disabled}
          autoComplete="off"
          placeholder={text.searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
          // On a phone the keyboard covers the lower half: bring the box and its results into view.
          onFocus={() => window.setTimeout(() => inputRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 250)}
          onKeyDown={(event) => {
            // A barcode scanner types and presses Enter: one match is added straight away.
            if (event.key === 'Enter') {
              event.preventDefault()
              if (results.length === 1 && !onOrder.has(results[0][0].productId)) add(results[0])
            }
          }}
          className="scroll-mt-4 w-full rounded-md border border-neutral-200 bg-white py-2.5 pr-3 pl-9 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none sm:text-sm"
        />
      </div>

      {searching && search.loading && !search.lines && (
        <div role="status" aria-busy="true" className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}
      {searching && search.error && !search.lines && <ErrorState variant="inline" message={search.error} />}
      {searching && search.lines && results.length === 0 && !search.loading && (
        <p className="text-sm text-neutral-600">
          {text.noMatch(query.trim())}{' '}
          <Link
            to="/app/products/new"
            className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
          >
            {text.addProductFirst}
          </Link>
        </p>
      )}
      {searching && results.length > 0 && (
        <>
          <ProductList groups={results} onOrder={onOrder} onAdd={add} disabled={disabled} showCode changing={changing} />
          {results.length >= PICKER_LIMIT && <p className="text-xs text-neutral-500">{text.narrow}</p>}
        </>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white" data-order-lines>
          {items.map((item) => (
            <ItemLine
              key={item.key}
              item={item}
              autoFocus={item.key === focusProductId}
              onChange={(patch) => onChange(item.key, patch)}
              onRemove={() => onRemove(item.key)}
              disabled={disabled}
              changing={changing}
              withPrices={withPrices}
            />
          ))}
        </ul>
      )}

      {!searching && suggested.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-medium text-neutral-600">
            {suggestions.kind === 'low' ? text.runningLowFrom(supplierName) : text.usualFrom(supplierName)}
          </h3>
          <ProductList groups={suggested} onOrder={onOrder} onAdd={add} disabled={disabled} changing={changing} />
        </div>
      )}
    </section>
  )
}

/** "3 bags left · low · 10 coming" — the facts beside a product, in the unit being ordered. */
function stockWords(option: PickerLine, withLastTime = false, changing = false): { text: string; low: boolean } {
  const parts: string[] = []
  const unitFor = (amount: number) => quantityUnitWord(option, amount)
  let low = false
  if (option.stockState === 'OUT') {
    parts.push(text.out)
    low = true
  } else if (option.left != null) {
    const left = text.left(leftWords(option))
    low = option.stockState === 'LOW'
    parts.push(low ? `${left} · ${text.low}` : left)
  }
  if (option.coming != null && option.coming > 0) {
    const amount = `${formatQuantity(option.coming)} ${unitFor(option.coming)}`
    parts.push(changing ? text.comingOther(amount) : text.coming(amount))
  }
  if (withLastTime && option.lastOrdered != null) {
    parts.push(text.lastTime(`${formatQuantity(option.lastOrdered)} ${unitFor(option.lastOrdered)}`))
  }
  return { text: parts.join(' · '), low }
}

/**
 * What is left, said in whole packs and what is over: "12 bags + 100 g", never "12.1 bags" — a
 * storekeeper counts bags, and the loose remainder is real stock too.
 */
function leftWords(option: PickerLine): string {
  const onHand = option.onHand ?? null
  if (!option.pack || onHand == null || !(option.perUnit > 1)) {
    const amount = onHand ?? option.left ?? 0
    return `${formatQuantity(amount)} ${quantityUnitWord(option, amount)}`
  }
  const whole = Math.floor(onHand / option.perUnit + 1e-9)
  const rest = Math.round((onHand - whole * option.perUnit) * 1000) / 1000
  // "Bag · 1,000 g" -> "g": the product's own unit is what follows the pack size.
  const base = option.comesIn.split(' · ').slice(1).join(' · ').replace(/^[\d.,\s]+/, '').trim()
  const packs = `${formatQuantity(whole)} ${quantityUnitWord(option, whole)}`
  if (rest <= 0) return packs
  const loose = `${formatQuantity(rest)} ${base}`
  return whole > 0 ? `${packs} + ${loose}` : loose
}

/**
 * What the price box is measured against: "same as last time", or "last paid ₦44,500 on 15 Oct" —
 * in amber when the price typed is higher, which is what whoever checks the order looks for.
 */
function priceHint(option: PickerLine, typed: number | null): { text: string; higher: boolean } | null {
  if (option.lastPrice == null) return null
  const paid = option.lastPriceKind !== 'ORDERED'
  if (typed != null && typed === option.lastPrice) return { text: paid ? text.priceSamePaid : text.priceSameAgreed, higher: false }
  const amount = orderMoney(option.lastPrice)
  const day = option.lastPriceOn ? shortDate(option.lastPriceOn) : ''
  return {
    text: paid ? text.priceLastPaid(amount, day) : text.priceLastAgreed(amount, day),
    higher: typed != null && typed > option.lastPrice,
  }
}

/** The unit chooser's words: "bags", with the size only when two packs share a word. */
function unitLabel(choice: PickerLine, all: PickerLine[]): string {
  const word = unitChoiceWord(choice)
  const shared = all.filter((other) => unitChoiceWord(other) === word).length > 1
  return shared && choice.pack ? `${word} of ${choice.comesIn.split(' · ').slice(1).join(' · ')}` : word
}

function ProductList({
  groups,
  onOrder,
  onAdd,
  disabled,
  showCode,
  changing,
}: {
  groups: PickerLine[][]
  onOrder: ReadonlySet<string>
  onAdd: (options: PickerLine[]) => void
  disabled?: boolean
  showCode?: boolean
  changing?: boolean
}) {
  return (
    <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
      {groups.map((group) => {
        const usual = usualOption(group)
        const facts = stockWords(usual, true, changing)
        const added = onOrder.has(usual.productId)
        return (
          <li key={usual.productId} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-neutral-900">
                {usual.productName}
                {showCode && usual.sku && <span className="ml-2 text-xs font-normal text-neutral-500">{usual.sku}</span>}
              </span>
              {facts.text && (
                <span className={`block text-xs ${facts.low ? 'font-medium text-warning-800' : 'text-neutral-600'}`}>{facts.text}</span>
              )}
            </span>
            {added ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-sm text-neutral-500">
                <Check className="h-4 w-4 text-accent-600" aria-hidden="true" />
                {text.added}
              </span>
            ) : (
              <Button variant="secondary" disabled={disabled} onClick={() => onAdd(group)} aria-label={text.addLabel(usual.productName)}>
                {text.add}
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ItemLine({
  item,
  autoFocus,
  onChange,
  onRemove,
  disabled,
  changing,
  withPrices = true,
}: {
  item: OrderItem
  autoFocus: boolean
  onChange: (patch: Partial<Pick<OrderItem, 'unit' | 'quantity' | 'price'>>) => void
  onRemove: () => void
  disabled?: boolean
  changing?: boolean
  withPrices?: boolean
}) {
  const option = chosenOption(item)
  const facts = stockWords(option, false, changing)
  // The chooser says "bags"; the size is said here, once: "bags of 1,000 g · 12 bags + 100 g left".
  const size = option.pack ? `${unitChoiceWord(option)} of ${option.comesIn.split(' · ').slice(1).join(' · ')}` : ''
  const invalid = quantityInvalid(item)
  const quantity = quantityOf(item)
  const quantityRef = useRef<HTMLInputElement>(null)
  const quantityId = `po-qty-${item.key.replace(/[^a-zA-Z0-9-]/g, '-')}`
  const priceId = `po-price-${item.key.replace(/[^a-zA-Z0-9-]/g, '-')}`
  const perWord = quantityUnitWord(option, 1)
  const badPrice = priceInvalid(item)
  const amount = amountOf(item)
  const hint = priceHint(option, priceOf(item))

  useEffect(() => {
    if (autoFocus) quantityRef.current?.focus()
  }, [autoFocus])

  return (
    <li className="relative px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={quantityId} className="block text-sm font-semibold text-neutral-900">
            {item.productName}
            <span className="sr-only">, {text.quantityLabel(item.productName)}</span>
          </label>
          {(size || facts.text) && (
            <p className="text-xs text-neutral-600">
              {size}
              {size && facts.text && ' · '}
              {facts.text && <span className={facts.low ? 'font-medium text-warning-800' : ''}>{facts.text}</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-stretch overflow-hidden rounded-md border border-neutral-200 bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
            <button
              type="button"
              disabled={disabled || (quantity ?? 0) <= 1}
              onClick={() => onChange({ quantity: stepQuantity(item, -1) })}
              aria-label={text.less(item.productName)}
              className="px-2 text-neutral-600 hover:bg-neutral-100 disabled:text-neutral-300"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              ref={quantityRef}
              id={quantityId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={item.quantity}
              disabled={disabled}
              onChange={(event) => onChange({ quantity: event.target.value })}
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? `${quantityId}-error` : undefined}
              className={`w-14 border-x py-2 text-center text-base font-semibold tabular-nums text-neutral-900 placeholder:font-normal placeholder:text-neutral-400 focus:outline-none sm:text-sm ${
                invalid ? 'border-danger-300 bg-danger-50' : 'border-neutral-200'
              }`}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ quantity: stepQuantity(item, 1) })}
              aria-label={text.more(item.productName)}
              className="px-2 text-neutral-600 hover:bg-neutral-100"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {/* One fixed-width column for the unit, chooser or word, so every line's × lines up. */}
          <div className="w-24">
            {item.options.length > 1 ? (
              <select
                value={item.unit}
                disabled={disabled}
                onChange={(event) => onChange({ unit: event.target.value })}
                aria-label={text.unitLabel(item.productName)}
                className="h-9 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm text-neutral-800"
              >
                {item.options.map((choice) => (
                  <option key={choice.unit} value={choice.unit}>
                    {unitLabel(choice, item.options)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="block px-2 text-sm text-neutral-700">{quantityUnitWord(option, quantity)}</span>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={text.remove(item.productName)}
            className="-mr-1 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {invalid && (
        <p id={`${quantityId}-error`} className="mt-1 text-right text-xs text-danger-700">
          {text.quantityInvalid}
        </p>
      )}
      {/* The price row (plan section 11.4): price per unit as ordered, and the line's amount under the unit column. */}
      {withPrices && (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1 text-xs text-neutral-600">
          <label htmlFor={priceId}>
            {text.pricePer(perWord)}
            <span className="sr-only">, {item.productName}</span>
          </label>
          {hint && <span className={hint.higher ? 'font-medium text-warning-800' : ''}> · {hint.text}</span>}
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center rounded-md border bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100 ${
              badPrice ? 'border-danger-300 bg-danger-50' : 'border-neutral-200'
            }`}
          >
            <span className="pl-2.5 text-sm text-neutral-500" aria-hidden="true">
              ₦
            </span>
            <input
              id={priceId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={text.pricePlaceholder}
              value={priceText(item)}
              disabled={disabled}
              onChange={(event) => onChange({ price: event.target.value })}
              onBlur={() => {
                // "45000" reads back as "45,000" once the cursor leaves.
                const value = priceOf(item)
                if (value != null) onChange({ price: moneyText(value) })
              }}
              aria-invalid={badPrice || undefined}
              aria-describedby={badPrice ? `${priceId}-error` : undefined}
              className="w-24 bg-transparent py-2 pr-2.5 pl-1 text-right text-base font-semibold tabular-nums text-neutral-900 placeholder:font-normal placeholder:text-neutral-400 focus:outline-none sm:text-sm"
            />
          </div>
          <span className="w-24 text-right text-sm font-semibold tabular-nums text-neutral-900" aria-live="polite">
            {amount != null ? orderMoney(amount) : <span className="font-normal text-neutral-400">{text.noAmount}</span>}
          </span>
          {/* Lines the amount up under the unit column, past the remove button's place. */}
          <span className="w-6" aria-hidden="true" />
        </div>
      </div>
      )}
      {withPrices && badPrice && (
        <p id={`${priceId}-error`} className="mt-1 text-right text-xs text-danger-700">
          {text.priceInvalid}
        </p>
      )}
    </li>
  )
}
