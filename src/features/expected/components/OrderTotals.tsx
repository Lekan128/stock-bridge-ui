import { useRef, useState } from 'react'
import { expectedCopy } from '@/features/expected/copy'
import { orderMoney } from '@/features/expected/expected'
import { moneyOf } from '@/features/expected/orderItems'

const text = expectedCopy.form

export interface OrderTotalsProps {
  supplierName: string
  /** The lines added up; null until every line has a price. */
  itemsTotal: number | null
  /** The delivery charge as typed: empty is "not said", 0 is free. */
  delivery: string
  onDeliveryChange: (typed: string) => void
  deliveryInvalid: boolean
  /** Items plus delivery; null until every line has a price. */
  total: number | null
  disabled?: boolean
}

/**
 * Under the items (plan section 11.4): Items, Delivery and Total. Delivery is one short line with
 * "Add" or "Change" that opens in place, because most orders never have one written down.
 */
export function OrderTotals({ supplierName, itemsTotal, delivery, onDeliveryChange, deliveryInvalid, total, disabled }: OrderTotalsProps) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const charge = moneyOf(delivery)
  const said = delivery.trim() !== ''
  const open = editing || deliveryInvalid

  return (
    <section aria-label={text.totalsLabel} className="rounded-lg border border-neutral-200 bg-white text-sm">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3 pb-1.5">
        <span className="text-neutral-600">{text.itemsTotal}</span>
        <span className="tabular-nums text-neutral-900">{itemsTotal != null ? orderMoney(itemsTotal) : text.noAmount}</span>
      </div>

      <div className="px-4 py-1.5">
        {open ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="po-delivery" className="text-neutral-600">
              {text.deliveryLabel(supplierName)}
            </label>
            <div className="flex items-center gap-2">
              <div
                className={`flex flex-1 items-center rounded-md border bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100 ${
                  deliveryInvalid ? 'border-danger-300 bg-danger-50' : 'border-neutral-200'
                }`}
              >
                <span className="pl-2.5 text-neutral-500" aria-hidden="true">
                  ₦
                </span>
                <input
                  ref={inputRef}
                  id="po-delivery"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  autoFocus
                  value={delivery}
                  disabled={disabled}
                  onChange={(event) => onDeliveryChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      if (!deliveryInvalid) setEditing(false)
                    }
                  }}
                  aria-invalid={deliveryInvalid || undefined}
                  aria-describedby="po-delivery-hint"
                  className="w-full bg-transparent py-2 pr-2.5 pl-1 text-right text-base font-semibold tabular-nums text-neutral-900 focus:outline-none sm:text-sm"
                />
              </div>
              <button
                type="button"
                disabled={disabled || deliveryInvalid}
                onClick={() => setEditing(false)}
                className="rounded-md px-2 py-2 font-medium text-primary-700 hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none disabled:text-neutral-400"
              >
                {text.deliveryDone}
              </button>
            </div>
            <p id="po-delivery-hint" className={`text-xs ${deliveryInvalid ? 'text-danger-700' : 'text-neutral-500'}`}>
              {deliveryInvalid ? text.deliveryInvalid : text.deliveryHint}
            </p>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-neutral-600">{text.delivery}</span>
            <span className="flex items-baseline gap-2">
              <span className={`tabular-nums ${said ? 'text-neutral-900' : 'text-neutral-500'}`}>
                {!said ? text.deliveryNotSaid : charge === 0 ? text.deliveryFree : orderMoney(charge ?? 0)}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setEditing(true)}
                className="rounded-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
              >
                {said ? text.deliveryChange : text.deliveryAdd}
              </button>
            </span>
          </div>
        )}
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-neutral-200 px-4 py-3">
        <span className="font-semibold text-neutral-900">{text.total}</span>
        <span className="text-base font-semibold tabular-nums text-neutral-900" aria-live="polite">
          {total != null ? orderMoney(total) : text.noAmount}
        </span>
      </div>
    </section>
  )
}
