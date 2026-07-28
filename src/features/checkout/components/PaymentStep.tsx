import { ArrowLeft, ArrowRight, CircleAlert, CreditCard, Info, Wallet } from 'lucide-react'
import { Button } from '@/components/Button'
import type { PaymentMethod } from '@/constants/orderStatus'
import type { CheckoutQuote } from '@/features/checkout/types'
import { formatNaira, formatNairaWhole } from '@/utils/money'

export interface PaymentStepProps {
  quote: CheckoutQuote | null
  value: PaymentMethod
  onChange: (method: PaymentMethod) => void
  /**
   * Set once `POST /api/payments/monnify/initialize` has answered 503 — Monnify is not configured
   * on this deployment. Online payment is then genuinely impossible and the step degrades to
   * pay-on-delivery rather than dead-ending on a button that cannot work.
   */
  onlinePaymentUnavailable?: boolean
  onBack: () => void
  onContinue: () => void
}

interface MethodOption {
  method: PaymentMethod
  icon: typeof CreditCard
  title: string
  body: string
  /** Non-empty when the option cannot be picked; every string is rendered as the reason. */
  reasons: string[]
}

/**
 * Step 2 — how the order is paid for.
 *
 * Eligibility is not computed here. `payOnDeliveryEligible` and, crucially,
 * `payOnDeliveryReasons` come from the quote and the reasons are rendered verbatim (contract §10):
 * the caps and payment-terms rules behind them are commercial policy the server owns, and a
 * client-side paraphrase drifts the moment ProcurePal changes a limit.
 */
export function PaymentStep({
  quote,
  value,
  onChange,
  onlinePaymentUnavailable = false,
  onBack,
  onContinue,
}: PaymentStepProps) {
  const podReasons = quote?.payOnDeliveryEligible === false ? (quote.payOnDeliveryReasons ?? []) : []
  // Defensive: the server should always send a reason with an ineligible verdict, but a silently
  // disabled radio is exactly what the UX bar forbids, so there is a fallback sentence.
  const payOnDeliveryReasons =
    podReasons.length > 0
      ? podReasons
      : quote?.payOnDeliveryEligible === false
        ? ['Pay on delivery is not available for this order.']
        : []

  const options: MethodOption[] = [
    {
      method: 'MONNIFY',
      icon: CreditCard,
      title: 'Pay now',
      body: 'Card, bank transfer or USSD through Monnify. Your order is confirmed as soon as the payment clears.',
      reasons: onlinePaymentUnavailable
        ? ['Online payment is temporarily unavailable. Please choose pay on delivery.']
        : [],
    },
    {
      method: 'PAY_ON_DELIVERY',
      icon: Wallet,
      title: 'Pay on delivery',
      body: quote?.payOnDeliveryMaxOrderValue
        ? `Settle when the goods arrive. Available on orders up to ${formatNairaWhole(quote.payOnDeliveryMaxOrderValue)}.`
        : 'Settle when the goods arrive.',
      reasons: payOnDeliveryReasons,
    },
  ]

  const selectedOption = options.find((option) => option.method === value)
  const selectionBlocked = (selectedOption?.reasons.length ?? 0) > 0

  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900">How would you like to pay?</h2>
      {quote && (
        <p className="mt-1 text-sm text-neutral-500">
          Total due: <span className="font-medium text-neutral-900">{formatNaira(quote.total)}</span>
        </p>
      )}

      {onlinePaymentUnavailable && (
        <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning-700" aria-hidden="true" />
          <p className="text-sm text-warning-900">
            Online payment is not available right now. Your order has not been lost — choose pay on delivery below, or
            come back shortly and try paying online again.
          </p>
        </div>
      )}

      <fieldset className="mt-4">
        <legend className="sr-only">Payment method</legend>
        <div className="space-y-3">
          {options.map((option) => {
            const disabled = option.reasons.length > 0
            const selected = value === option.method && !disabled
            const reasonId = `${option.method}-reasons`
            return (
              <div key={option.method}>
                <label
                  className={`flex items-start gap-3 rounded-lg border p-4 transition-colors focus-within:ring-2 focus-within:ring-primary-500 ${
                    selected
                      ? 'border-primary-500 bg-primary-50'
                      : disabled
                        ? 'cursor-not-allowed border-neutral-200 bg-neutral-50'
                        : 'cursor-pointer border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={option.method}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onChange(option.method)}
                    aria-describedby={disabled ? reasonId : undefined}
                    className="mt-1 h-4 w-4 shrink-0 accent-primary-600"
                  />
                  <option.icon
                    className={`mt-0.5 h-5 w-5 shrink-0 ${disabled ? 'text-neutral-300' : 'text-primary-600'}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${disabled ? 'text-neutral-400' : 'text-neutral-900'}`}>
                      {option.title}
                    </p>
                    <p className={`mt-0.5 text-sm ${disabled ? 'text-neutral-400' : 'text-neutral-600'}`}>
                      {option.body}
                    </p>
                  </div>
                </label>
                {disabled && (
                  <ul id={reasonId} className="mt-1.5 space-y-1 pl-4">
                    {option.reasons.map((reason) => (
                      <li key={reason} className="flex items-start gap-1.5 text-xs text-neutral-600">
                        <CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-warning-600" aria-hidden="true" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </fieldset>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Button>
        <Button onClick={onContinue} disabled={selectionBlocked} aria-describedby="payment-continue-reason">
          Review your order
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {selectionBlocked && (
        <p id="payment-continue-reason" className="mt-2 text-xs text-danger-600">
          {selectedOption?.reasons[0]}
        </p>
      )}
    </section>
  )
}
