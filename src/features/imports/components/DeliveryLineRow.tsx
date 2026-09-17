import { useEffect, useId, useRef, useState } from 'react'
import { copy } from '@/features/imports/copy'
import {
  formatPrice,
  perUnitWords,
  quantityIsInvalid,
  typedPrice,
  validQuantity,
  type DeliveryEntry,
} from '@/features/imports/delivery'
import type { DeliveryLine } from '@/features/imports/types'

export interface DeliveryLineRowProps {
  line: DeliveryLine
  /** Absent until something is typed on this line. */
  entry?: DeliveryEntry
  onChange: (line: DeliveryLine, patch: Partial<Omit<DeliveryEntry, 'line'>>) => void
}

const INPUT_CLASS =
  'rounded-md border px-3 py-2 text-right text-base text-neutral-900 tabular-nums placeholder:text-left placeholder:text-xs placeholder:text-neutral-400 focus:outline-none focus:ring-2 sm:text-sm'

function inputTone(invalid: boolean): string {
  return invalid
    ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-100'
    : 'border-neutral-200 focus:border-primary-500 focus:ring-primary-100'
}

/**
 * One way of buying one product: its label, how many arrived, and — once there is a quantity —
 * what one of them cost.
 *
 * The price is shown as a sentence first ("₦42,000 a bag · same as last time") because on most
 * deliveries it has not changed, and an input pre-filled with the old price invites a stray
 * keystroke to change it. "Change" opens the input. A line with no price on record has nothing to
 * say, so it opens with the input straight away; leaving it blank is allowed.
 *
 * The inputs are 16px on a phone so iOS does not zoom the page when one is focused.
 */
export function DeliveryLineRow({ line, entry, onChange }: DeliveryLineRowProps) {
  const quantityId = useId()
  const priceId = useId()
  const priceRef = useRef<HTMLInputElement>(null)
  const [focusPrice, setFocusPrice] = useState(false)

  const quantity = validQuantity(entry)
  const quantityInvalid = quantityIsInvalid(entry)
  const price = typedPrice(entry)
  const priceInvalid = price != null && Number.isNaN(price)
  const per = perUnitWords(line)
  const showPriceInput = line.lastPrice == null || entry?.editingPrice === true
  const priceHint = priceInvalid
    ? copy.delivery.priceInvalid
    : line.lastPrice != null
      ? copy.delivery.priceLast(formatPrice(line.lastPrice), per)
      : null

  // Focus follows "Change" so a keyboard or screen-reader user lands in the field they asked for.
  useEffect(() => {
    if (!focusPrice) return
    priceRef.current?.focus()
    setFocusPrice(false)
  }, [focusPrice])

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={quantityId} className="min-w-0 flex-1 text-sm text-neutral-700">
          <span aria-hidden="true">{line.comesIn}</span>
          <span className="sr-only">{copy.delivery.quantityLabel(line.productName, line.comesIn)}</span>
        </label>
        <input
          id={quantityId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={entry?.quantity ?? ''}
          onChange={(event) => onChange(line, { quantity: event.target.value })}
          aria-invalid={quantityInvalid || undefined}
          aria-describedby={quantityInvalid ? `${quantityId}-error` : undefined}
          className={`w-24 ${INPUT_CLASS} ${inputTone(quantityInvalid)}`}
        />
      </div>
      {quantityInvalid && (
        <p id={`${quantityId}-error`} className="mt-1 text-right text-xs text-danger-600">
          {copy.delivery.quantityInvalid}
        </p>
      )}

      {quantity != null && !showPriceInput && line.lastPrice != null && (
        <p className="mt-1.5 flex flex-wrap items-center justify-end gap-x-2 text-xs text-neutral-500">
          <span>{copy.delivery.priceSame(formatPrice(line.lastPrice), per)}</span>
          <button
            type="button"
            onClick={() => {
              onChange(line, { editingPrice: true })
              setFocusPrice(true)
            }}
            aria-label={copy.delivery.priceChangeLabel(line.productName, line.comesIn)}
            className="rounded-sm px-1 py-0.5 font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {copy.delivery.priceChange}
          </button>
        </p>
      )}

      {quantity != null && showPriceInput && (
        <div className="mt-2 flex flex-col items-end gap-1">
          <label htmlFor={priceId} className="sr-only">
            {copy.delivery.priceLabel(line.productName, line.comesIn)}
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500" aria-hidden="true">
              ₦
            </span>
            <input
              ref={priceRef}
              id={priceId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={line.lastPrice != null ? formatPrice(line.lastPrice) : copy.delivery.pricePlaceholder}
              value={entry?.price ?? ''}
              onChange={(event) => onChange(line, { price: event.target.value })}
              aria-invalid={priceInvalid || undefined}
              aria-describedby={priceHint ? `${priceId}-hint` : undefined}
              className={`w-40 ${INPUT_CLASS} ${inputTone(priceInvalid)}`}
            />
            <span className="whitespace-nowrap text-xs text-neutral-500">{per}</span>
          </div>
          {priceHint && (
            <p id={`${priceId}-hint`} className={`text-xs ${priceInvalid ? 'text-danger-600' : 'text-neutral-500'}`}>
              {priceHint}
            </p>
          )}
        </div>
      )}
    </li>
  )
}
