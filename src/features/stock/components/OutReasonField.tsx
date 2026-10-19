import { useId } from 'react'
import { X } from 'lucide-react'
import type { OutReason } from '@/features/products/types'
import { OUT_REASONS, outReasonLabel } from '@/features/stock/outReasons'

const LINK_CLASS =
  'self-start rounded-sm text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'

export interface OutReasonFieldProps {
  value: OutReason | null
  onChange: (reason: OutReason | null) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The optional reason on a stock-out (`SELLING_PRICE_PLAN.md` §6.3), in its three states:
 *
 * - **Closed, none chosen** — a quiet "Add a reason" link, the same shape as "Add a note" beside it,
 *   so the sheet costs nobody a click or a decision they did not want to make.
 * - **Open** — the reasons as a short list of radio rows. Picking one closes it.
 * - **Chosen** — "Reason: Expired" with a ✕ to take it off. Tapping the reason opens the list again.
 *
 * Nothing here ever picks a reason on the person's behalf: closed with none chosen sends nothing,
 * which the ledger records as "No reason given".
 *
 * Render {@link OutReasonLink} where the closed states go (beside "Add a note") and this where the
 * open list goes; both read the same props.
 */
export function OutReasonChooser({ value, onChange, open, onOpenChange }: OutReasonFieldProps) {
  const legendId = useId()
  if (!open) return null
  return (
    <fieldset aria-labelledby={legendId} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <legend id={legendId} className="text-sm font-medium text-neutral-700">
          Why did it go out? <span className="font-normal text-neutral-500">(optional)</span>
        </legend>
        <button type="button" onClick={() => onOpenChange(false)} className={LINK_CLASS}>
          Close
        </button>
      </div>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {OUT_REASONS.map((option) => (
          // A whole row is the target, not only the dot: this is chosen on a phone, often one-handed.
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-1 text-sm text-neutral-800 hover:bg-neutral-50"
          >
            <input
              type="radio"
              name={`${legendId}-reason`}
              value={option.value}
              checked={value === option.value}
              onChange={() => {
                onChange(option.value)
                onOpenChange(false)
              }}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** The closed states: "Add a reason", or the chosen reason with a ✕. Renders nothing while open. */
export function OutReasonLink({ value, onChange, open, onOpenChange }: OutReasonFieldProps) {
  if (open) return null
  if (value == null) {
    return (
      <button type="button" onClick={() => onOpenChange(true)} className={LINK_CLASS}>
        Add a reason
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-neutral-200 bg-neutral-50 pl-2.5 text-sm text-neutral-800">
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="min-h-9 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        aria-label={`Reason: ${outReasonLabel(value)}. Change it`}
      >
        <span className="text-neutral-500">Reason:</span> {outReasonLabel(value)}
      </button>
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-label="Remove the reason"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </span>
  )
}
