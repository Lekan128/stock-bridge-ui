import { PartyPopper, Truck } from 'lucide-react'
import { formatNaira, formatNairaWhole } from '@/utils/money'

export interface FreeDeliveryNudgeProps {
  subtotal: number
  deliveryFee: number
  freeDeliveryThreshold: number
  className?: string
}

/**
 * "You're ₦X away from free delivery", with a progress bar.
 *
 * Renders nothing when there is no threshold configured — an empty promise bar is worse than no
 * bar. Once the threshold is met it flips to confirming the saving rather than disappearing, so
 * the buyer can see *why* the delivery line went to zero further down the summary.
 */
export function FreeDeliveryNudge({
  subtotal,
  deliveryFee,
  freeDeliveryThreshold,
  className = '',
}: FreeDeliveryNudgeProps) {
  if (!freeDeliveryThreshold || freeDeliveryThreshold <= 0) return null

  const remaining = Math.max(freeDeliveryThreshold - subtotal, 0)
  const qualified = remaining === 0
  const progress = Math.min(Math.round((subtotal / freeDeliveryThreshold) * 100), 100)

  return (
    <div
      className={`rounded-lg border p-3 ${qualified ? 'border-accent-200 bg-accent-50' : 'border-primary-100 bg-primary-50'} ${className}`}
    >
      <p className={`flex items-start gap-2 text-sm ${qualified ? 'text-accent-800' : 'text-primary-800'}`}>
        {qualified ? (
          <PartyPopper className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <Truck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <span>
          {qualified ? (
            <>
              Delivery is on us — you saved <strong className="font-semibold">{formatNaira(deliveryFee)}</strong> on
              this order.
            </>
          ) : (
            <>
              Add <strong className="font-semibold">{formatNaira(remaining)}</strong> more to get free delivery on
              orders over {formatNairaWhole(freeDeliveryThreshold)}.
            </>
          )}
        </span>
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-white"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress towards free delivery"
      >
        <div
          className={`h-full rounded-full transition-all ${qualified ? 'bg-accent-500' : 'bg-primary-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
