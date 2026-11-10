import { Check } from 'lucide-react'
import type { CountBoxes } from '@/features/products/useCountBoxes'

/**
 * Every unit a product has, as round chips over its count boxes (owner, 2026-11-10): the ones it's counted in are on,
 * each with a box below; tap one to add or take away its box. Nothing hidden behind a menu, one word each - the unit
 * names a store keeper already uses. Not shown for a product with one unit: there's nothing to choose.
 */
export function CountUnitChips({
  count,
  productName,
  onAdded,
  size = 'md',
}: {
  count: CountBoxes
  productName: string
  /** A chip turned on: its box's index, to put the cursor in it. */
  onAdded?: (index: number) => void
  size?: 'md' | 'lg'
}) {
  if (count.chips.length < 2) return null
  return (
    <div role="group" aria-label={`Count ${productName} in`} className="flex flex-wrap gap-1.5" data-count-chips>
      {count.chips.map((chip) => {
        const last = chip.on && count.chips.filter((other) => other.on).length === 1
        return (
          <button
            key={chip.key}
            type="button"
            aria-pressed={chip.on}
            // The last box stays: a count needs somewhere to type.
            aria-disabled={last || undefined}
            onClick={() => {
              if (last) return
              const index = count.toggle(chip.key)
              if (index != null) onAdded?.(index)
            }}
            className={`inline-flex items-center gap-1 rounded-full border font-medium ${
              size === 'lg' ? 'h-10 px-4 text-base' : 'h-8 px-3 text-sm'
            } ${
              chip.on
                ? 'border-primary-600 bg-primary-600 text-white'
                : 'border-neutral-300 bg-white text-neutral-700 hover:border-primary-400'
            } ${last ? 'cursor-default' : ''}`}
          >
            {chip.on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            {chip.unit.label}
          </button>
        )
      })}
    </div>
  )
}
