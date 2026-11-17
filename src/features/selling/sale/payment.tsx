import { Banknote, CreditCard, Landmark, type LucideIcon } from 'lucide-react'
import { PAYMENT_LABELS, PAYMENT_METHODS, paymentLabel, type SalePaymentMethod } from '@/features/selling/sale/paymentMethod'

export type { SalePaymentMethod }

const ICONS: Record<SalePaymentMethod, LucideIcon> = { CASH: Banknote, TRANSFER: Landmark, CARD: CreditCard }

/** A picture and one word: "Cash", "Transfer", "Card" - or "Not recorded" for a sale from before. */
export function PaymentChip({ method }: { method?: SalePaymentMethod | null }) {
  const Icon = method == null ? null : ICONS[method]
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-neutral-800">
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {paymentLabel(method)}
    </span>
  )
}

/**
 * The three big payment buttons - each records the sale (or the change) in one tap. Nothing is picked
 * for the person: a guessed payment would make the cash count wrong.
 */
export function PaymentButtons({
  onPick,
  busy,
  current,
  label,
}: {
  onPick: (method: SalePaymentMethod) => void
  /** The one being recorded, shown as working; every button waits meanwhile. */
  busy?: SalePaymentMethod | null
  /** Changing how they paid: the one it is now, which isn't offered. */
  current?: SalePaymentMethod | null
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-3 gap-1.5">
      {PAYMENT_METHODS.map((method) => {
        const Icon = ICONS[method]
        const isCurrent = current === method
        return (
          <button
            key={method}
            type="button"
            disabled={busy != null || isCurrent}
            aria-busy={busy === method}
            onClick={() => onPick(method)}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-action px-2 text-sm font-semibold text-white hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            <Icon className={`h-4 w-4 ${busy === method ? 'animate-pulse' : ''}`} aria-hidden="true" />
            {PAYMENT_LABELS[method]}
          </button>
        )
      })}
    </div>
  )
}
