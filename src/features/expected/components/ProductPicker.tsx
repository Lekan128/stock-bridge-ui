import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Search } from 'lucide-react'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { expectedCopy } from '@/features/expected/copy'
import { PICKER_LIMIT, useProductSearch, useUsualProducts } from '@/features/expected/hooks/useProductPicker'
import { groupByProduct, lineKey } from '@/features/imports/delivery'
import type { DeliveryLine } from '@/features/imports/types'

export interface ProductPickerProps {
  /** The supplier chosen, if any — their usual products are offered before anything is typed. */
  vendorId: string
  supplierName?: string
  /** Lines already on the order, by `lineKey`, so a result says "Added" instead of offering it twice. */
  added: ReadonlySet<string>
  onAdd: (line: DeliveryLine) => void
  disabled?: boolean
}

/**
 * "What do you want?" — find a product, add it, then say how many (`PURCHASE_ORDER_PLAN.md`).
 *
 * It replaces a list of the whole catalog with a quantity box on every row, which is fine at ten
 * products and unusable at a thousand. Here nothing is loaded until it is asked for: the supplier's
 * usual products to start from, or a search by name, code or barcode, a handful of results at a
 * time. Each result row is one way of buying that product ("Bag · 50 kg"); `Add` puts it on the order
 * below, where its quantity is typed.
 *
 * A barcode scanner types digits and presses Enter, so Enter adds the result when there is exactly
 * one — a scan is then a single beep and a line on the order.
 */
export function ProductPicker({ vendorId, supplierName, added, onAdd, disabled }: ProductPickerProps) {
  const [text, setText] = useState('')
  const typed = useDebouncedValue(text, 250)
  const search = useProductSearch(typed)
  const usual = useUsualProducts(vendorId)
  const inputRef = useRef<HTMLInputElement>(null)

  // The box is the first thing wanted once a supplier is chosen.
  useEffect(() => {
    if (vendorId !== '') inputRef.current?.focus()
  }, [vendorId])

  const searching = text.trim().length > 0
  const results = search.lines
  const groups = groupByProduct(results ?? [])
  const suggestions = !searching && usual.lines && usual.lines.length > 0 ? groupByProduct(usual.lines) : []

  /** Adding clears the search: the results have done their job, and the line is now on the order below. */
  function add(line: DeliveryLine) {
    onAdd(line)
    setText('')
  }

  function handleEnter() {
    if (results && results.length === 1 && !added.has(lineKey(results[0]))) add(results[0])
  }

  /**
   * Bring the box to the top of the screen when it is used. On a phone the keyboard rises over the
   * lower half and the sticky button covers the bottom, so a search that stays where it was is typed
   * into blind; this puts it — and the results that open beneath it — where they can be seen.
   */
  function bringIntoView() {
    // After the keyboard has finished coming up, or the scroll lands in the wrong place.
    window.setTimeout(() => inputRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 250)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
        <label htmlFor="po-product-search" className="sr-only">
          {expectedCopy.picker.label}
        </label>
        <input
          ref={inputRef}
          id="po-product-search"
          type="search"
          value={text}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => setText(event.target.value)}
          onFocus={bringIntoView}
          onKeyDown={(event) => {
            // Enter must never submit anything; for a scanner it means "add what you found".
            if (event.key === 'Enter') {
              event.preventDefault()
              handleEnter()
            }
          }}
          placeholder={expectedCopy.picker.placeholder}
          className="scroll-mt-4 w-full rounded-md border border-neutral-200 bg-white py-2.5 pr-3 pl-9 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none disabled:bg-neutral-50 sm:text-sm"
        />
      </div>

      {searching && search.loading && !results && (
        <div role="status" aria-busy="true" aria-label={expectedCopy.picker.searching} className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {searching && search.error && !results && (
        <ErrorState variant="inline" message={search.error} />
      )}

      {searching && results && results.length === 0 && !search.loading && (
        <p className="text-sm text-neutral-600">
          {expectedCopy.picker.noMatch(text.trim())}{' '}
          <Link
            to="/app/products/new"
            className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
          >
            {expectedCopy.picker.addProductFirst}
          </Link>
        </p>
      )}

      {groups.length > 0 && (
        <ResultList groups={groups} added={added} onAdd={add} disabled={disabled} />
      )}
      {searching && groups.length >= PICKER_LIMIT && (
        <p className="text-xs text-neutral-500">{expectedCopy.picker.narrow}</p>
      )}

      {!searching && suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-neutral-500">
            {expectedCopy.picker.usualFrom(supplierName ?? expectedCopy.order.supplier.toLowerCase())}
          </h3>
          <ResultList groups={suggestions} added={added} onAdd={add} disabled={disabled} />
        </div>
      )}

      {!searching && suggestions.length === 0 && (
        <p className="text-sm text-neutral-600">{expectedCopy.picker.start}</p>
      )}
    </div>
  )
}

function ResultList({
  groups,
  added,
  onAdd,
  disabled,
}: {
  groups: ReturnType<typeof groupByProduct>
  added: ReadonlySet<string>
  onAdd: (line: DeliveryLine) => void
  disabled?: boolean
}) {
  /** "Add", or "Added ✓" once it is on the order. */
  const control = (line: DeliveryLine) =>
    added.has(lineKey(line)) ? (
      <span className="inline-flex shrink-0 items-center gap-1 text-sm text-neutral-500">
        <Check className="h-4 w-4 text-accent-600" aria-hidden="true" />
        {expectedCopy.picker.added}
      </span>
    ) : (
      <Button
        variant="secondary"
        disabled={disabled}
        onClick={() => onAdd(line)}
        aria-label={expectedCopy.picker.addLabel(line.productName, line.comesIn)}
      >
        {expectedCopy.picker.add}
      </Button>
    )

  return (
    <ul className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
      {groups.map((group) =>
        group.lines.length === 1 ? (
          // One way of buying it: one row — name, how it comes, and Add.
          <li key={group.productId} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="min-w-0">
              <span className="text-sm font-semibold text-neutral-900">
                {group.productName}
                <span className="ml-2 text-xs font-normal text-neutral-500">{group.sku}</span>
              </span>
              <span className="block text-xs text-neutral-600">{group.lines[0].comesIn}</span>
            </span>
            {control(group.lines[0])}
          </li>
        ) : (
          // Several ways (a bag, or loose): the name once, then a row for each.
          <li key={group.productId} className="px-4 py-2.5">
            <p className="text-sm font-semibold text-neutral-900">
              {group.productName}
              <span className="ml-2 text-xs font-normal text-neutral-500">{group.sku}</span>
            </p>
            <ul className="mt-0.5 flex flex-col">
              {group.lines.map((line) => (
                <li key={lineKey(line)} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="min-w-0 text-sm text-neutral-700">{line.comesIn}</span>
                  {control(line)}
                </li>
              ))}
            </ul>
          </li>
        ),
      )}
    </ul>
  )
}
