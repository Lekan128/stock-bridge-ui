import { ArrowLeft, CircleAlert, CreditCard, Lock, MapPin, Wallet } from 'lucide-react'
import { Button } from '@/components/Button'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/constants/orderStatus'
import type { CartItem } from '@/features/cart/types'
import type { CheckoutQuote, UnavailableLine } from '@/features/checkout/types'
import { ProductImage } from '@/features/products/components/ProductImage'
import { formatNaira } from '@/utils/money'
import { formatPerUnit, formatQuantity } from '@/utils/units'

export interface ReviewAddressSummary {
  label: string
  contactName: string
  contactPhone: string
  lines: string
  notes?: string
  /** True for an inline address that will not be kept in the address book. */
  oneOff?: boolean
}

export interface ReviewStepProps {
  quote: CheckoutQuote | null
  items: CartItem[]
  paymentMethod: PaymentMethod
  address: ReviewAddressSummary | null
  note: string
  onNoteChange: (note: string) => void
  /** Sentences from the quote (plus any client-side ones) explaining why submit is disabled. */
  blockers: string[]
  submitting: boolean
  onSubmit: () => void
  onBack: () => void
  submitError: string | null
  /** Lines the server refused at submit time — usually stock that went in the last few minutes. */
  failedLines: UnavailableLine[]
}

const NOTE_MAX = 1000

/**
 * Step 3 — everything one last time, then commit.
 *
 * The submit button is disabled only with a visible list of reasons, and those reasons are the
 * quote's own `blockers` strings rather than anything written here (contract §10). If the server
 * later refuses the order anyway — stock can go between quote and submit — the failed lines are
 * named rather than folded into a generic "something went wrong".
 */
export function ReviewStep({
  quote,
  items,
  paymentMethod,
  address,
  note,
  onNoteChange,
  blockers,
  submitting,
  onSubmit,
  onBack,
  submitError,
  failedLines,
}: ReviewStepProps) {
  const canSubmit = blockers.length === 0 && !!quote && !!address
  const PaymentIcon = paymentMethod === 'PAY_ON_DELIVERY' ? Wallet : CreditCard

  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900">Review your order</h2>
      <p className="mt-1 text-sm text-neutral-500">Check everything below, then place the order.</p>

      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-neutral-900">Delivering to</h3>
          {address ? (
            <div className="mt-2">
              <p className="text-sm font-medium text-neutral-900">{address.label}</p>
              <p className="mt-0.5 text-sm text-neutral-700">{address.contactName}</p>
              <p className="mt-0.5 flex items-start gap-1.5 text-sm text-neutral-600">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                {address.lines}
              </p>
              <p className="mt-0.5 text-sm text-neutral-600">{address.contactPhone}</p>
              {address.notes && (
                <p className="mt-2 rounded-md bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600">{address.notes}</p>
              )}
              {address.oneOff && (
                <p className="mt-2 text-xs text-neutral-500">Used for this order only — not saved to your address book.</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-danger-600">No delivery address selected. Go back and pick one.</p>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-neutral-900">Paying by</h3>
          <p className="mt-2 flex items-center gap-2 text-sm text-neutral-700">
            <PaymentIcon className="h-4 w-4 text-primary-600" aria-hidden="true" />
            {PAYMENT_METHOD_LABELS[paymentMethod]}
          </p>
          {paymentMethod === 'MONNIFY' && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-neutral-500">
              <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              You will be taken to Monnify's secure checkout to complete payment.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-neutral-900">
            {items.length} {items.length === 1 ? 'product' : 'products'}
          </h3>
          <ul className="mt-3 divide-y divide-neutral-100">
            {items.map((item) => {
              const failed = failedLines.find((line) => line.productId === item.productId)
              return (
                <li key={item.productId} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                  <ProductImage
                    src={item.imageUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md"
                    iconClassName="h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{item.productName}</p>
                    <p className="text-xs text-neutral-500">
                      {formatQuantity(item.quantity, item.unitOfMeasure)} · {formatNaira(item.unitPrice)}{' '}
                      {formatPerUnit(item.unitOfMeasure)}
                    </p>
                    {failed && <p className="mt-0.5 text-xs font-medium text-danger-600">{failed.reason}</p>}
                  </div>
                  <p className="shrink-0 text-sm font-medium text-neutral-900">{formatNaira(item.lineTotal)}</p>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <label htmlFor="checkout-note" className="block text-sm font-semibold text-neutral-900">
            Note for ProcurePal (optional)
          </label>
          <p className="mt-1 text-xs text-neutral-500">
            Purchase-order reference, delivery window, anything the fulfilment team should know.
          </p>
          <textarea
            id="checkout-note"
            rows={3}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="e.g. PO-4821. Please deliver before 3pm on Thursday."
            className="mt-2 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <p className="mt-1 text-right text-xs text-neutral-400">
            {note.length}/{NOTE_MAX}
          </p>
        </div>

        {quote && (
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Total</h3>
            <dl className="mt-2 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-neutral-600">Subtotal</dt>
                <dd className="font-medium text-neutral-900">{formatNaira(quote.subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-neutral-600">
                  Delivery
                  {quote.freeDeliveryApplied && <span className="text-accent-700"> (free on this order)</span>}
                </dt>
                <dd className={`font-medium ${quote.freeDeliveryApplied ? 'text-accent-700' : 'text-neutral-900'}`}>
                  {quote.freeDeliveryApplied ? formatNaira(0) : formatNaira(quote.deliveryFee)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-100 pt-2">
                <dt className="font-semibold text-neutral-900">
                  {paymentMethod === 'PAY_ON_DELIVERY' ? 'Due on delivery' : 'Due now'}
                </dt>
                <dd className="text-lg font-bold text-neutral-900">{formatNaira(quote.total)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      {submitError && (
        <div role="alert" className="mt-4 rounded-lg border border-danger-200 bg-danger-50 p-3.5">
          <p className="flex items-start gap-2 text-sm font-medium text-danger-800">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            We could not place your order
          </p>
          <p className="mt-1 pl-6 text-sm text-danger-700">{submitError}</p>
          {failedLines.length > 0 && (
            <ul className="mt-2 space-y-1 pl-6">
              {failedLines.map((line) => (
                <li key={line.productId} className="text-sm text-danger-700">
                  <span className="font-medium">{line.productName}</span> — {line.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Button>
        <Button
          onClick={onSubmit}
          loading={submitting}
          disabled={!canSubmit}
          aria-describedby={canSubmit ? undefined : 'review-blockers'}
          className="bg-accent-600 hover:bg-accent-700 focus-visible:ring-accent-500"
        >
          {paymentMethod === 'PAY_ON_DELIVERY' ? 'Place order' : 'Place order and pay'}
        </Button>
      </div>

      {!canSubmit && (
        <ul id="review-blockers" className="mt-2 space-y-1">
          {(blockers.length > 0 ? blockers : ['We are still pricing your order. Give it a moment.']).map((blocker) => (
            <li key={blocker} className="flex items-start gap-1.5 text-xs text-danger-600">
              <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              {blocker}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
