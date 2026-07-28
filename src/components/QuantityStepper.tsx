import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { formatQuantity } from '@/utils/units'

export interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  /**
   * Minimum order quantity (`products.min_order_quantity`). The UX bar requires MOQ to be
   * enforced here and explained, not silently rejected by the API — so decrementing below it is
   * blocked and `minReason` (or a generated fallback) is shown.
   */
  min?: number
  /** Upper bound, normally the seller's quantity on hand. */
  max?: number
  step?: number
  unitOfMeasure?: string | null
  /** Overrides the generated "Minimum order …" explanation. */
  minReason?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  /** Accessible name for the number input — required when there is no visible <label>. */
  label?: string
  id?: string
  className?: string
}

const sizeClasses = {
  sm: { button: 'h-8 w-8', input: 'h-8 w-12 text-sm', icon: 'h-3.5 w-3.5' },
  md: { button: 'h-10 w-10', input: 'h-10 w-16 text-sm', icon: 'h-4 w-4' },
}

function clamp(value: number, min: number, max: number | undefined): number {
  if (Number.isNaN(value)) return min
  if (max !== undefined && value > max) return max
  return Math.max(value, min)
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  step = 1,
  unitOfMeasure,
  minReason,
  disabled = false,
  size = 'md',
  label = 'Quantity',
  id,
  className = '',
}: QuantityStepperProps) {
  // Mirrored as a string so the field can hold a transient empty/partial value while typing —
  // committing on every keystroke would fight the user by clamping "1" on the way to "12".
  const [draft, setDraft] = useState(String(value))
  const [clampedTo, setClampedTo] = useState<'min' | 'max' | null>(null)
  const s = sizeClasses[size]

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  function commit(next: number) {
    const clamped = clamp(next, min, max)
    setClampedTo(clamped !== next ? (clamped === min ? 'min' : 'max') : null)
    setDraft(String(clamped))
    if (clamped !== value) onChange(clamped)
  }

  const atMin = value <= min
  const atMax = max !== undefined && value >= max
  const showMinNote = min > 1
  const minNote = minReason ?? `Minimum order ${formatQuantity(min, unitOfMeasure)}.`
  const maxNote = max !== undefined ? `Only ${formatQuantity(max, unitOfMeasure)} available.` : null

  return (
    <div className={className}>
      <div className="inline-flex items-stretch overflow-hidden rounded-md border border-neutral-200 bg-white">
        <button
          type="button"
          onClick={() => commit(value - step)}
          disabled={disabled || atMin}
          aria-label={`Decrease ${label.toLowerCase()}`}
          className={`flex items-center justify-center text-neutral-600 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:text-neutral-300 ${s.button}`}
        >
          <Minus className={s.icon} />
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={draft}
          disabled={disabled}
          aria-label={label}
          aria-describedby={showMinNote && id ? `${id}-moq` : undefined}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={() => commit(Number.parseInt(draft, 10))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit(Number.parseInt(draft, 10))
            }
          }}
          className={`border-x border-neutral-200 text-center font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 disabled:bg-neutral-50 disabled:text-neutral-400 ${s.input}`}
        />
        <button
          type="button"
          onClick={() => commit(value + step)}
          disabled={disabled || atMax}
          aria-label={`Increase ${label.toLowerCase()}`}
          className={`flex items-center justify-center text-neutral-600 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:text-neutral-300 ${s.button}`}
        >
          <Plus className={s.icon} />
        </button>
      </div>

      {/* aria-live so a clamp is announced — a screen-reader user must not be left wondering
          why their typed quantity changed. */}
      <div aria-live="polite" className="min-h-0">
        {clampedTo === 'max' && maxNote && <p className="mt-1.5 text-xs text-warning-700">{maxNote}</p>}
        {clampedTo === 'min' && showMinNote && <p className="mt-1.5 text-xs text-warning-700">{minNote}</p>}
      </div>

      {clampedTo !== 'min' && showMinNote && (
        <p id={id ? `${id}-moq` : undefined} className="mt-1.5 text-xs text-neutral-500">
          {minNote}
        </p>
      )}
    </div>
  )
}
