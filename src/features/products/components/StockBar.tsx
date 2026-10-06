import { formatNumber, stockUnitWord } from '@/features/products/unitCopy'

export interface StockBarProps {
  quantity: number
  /** The low-stock alert level, in stock units. No bar without one: there is nothing to measure against. */
  threshold: number | null | undefined
  /** The server's verdict (`isLowStock`), so the bar never disagrees with the Low-stock filter. */
  low: boolean
  unit: string
  /** `row` under a list figure; `hero` under the product's headline figure, with its scale spelled out. */
  size?: 'row' | 'hero'
}

/**
 * On hand against the low-stock alert level, as a thin bar (plan Track B, B2). It replaces the
 * stripe + badge + border that used to say "low" three times on one row, and it carries the real
 * figure: how far above or below the line this product sits.
 *
 * The line (a tick) sits at half the bar, so "twice the alert level" fills it. Healthy stock is
 * grey — most rows carry no colour at all; amber and red are earned. Low and Out also say so in a
 * word, so the state never rests on colour alone.
 */
export function StockBar({ quantity, threshold, low, unit, size = 'row' }: StockBarProps) {
  if (threshold == null || threshold <= 0) return null
  const out = quantity <= 0
  const share = Math.max(0, Math.min(1, quantity / (threshold * 2)))
  const state = out ? 'out' : low ? 'low' : 'ok'
  const fill = state === 'out' ? '' : state === 'low' ? 'bg-warning-500' : 'bg-neutral-300'
  const word = state === 'out' ? 'Out' : state === 'low' ? 'Low' : null
  const description = `${word ?? 'Above the alert level'}: ${formatNumber(Math.max(0, quantity))} on hand, alert at ${formatNumber(threshold)} ${stockUnitWord(unit, threshold)}.`

  return (
    <div className={`flex items-center gap-2 ${size === 'hero' ? 'w-full max-w-xs' : 'w-full max-w-[9rem]'}`} data-stock-bar={state}>
      <div className={`relative flex-1 overflow-hidden rounded-full bg-neutral-100 ${size === 'hero' ? 'h-2' : 'h-1.5'}`} aria-hidden="true">
        {fill && <div className={`absolute inset-y-0 left-0 rounded-full ${fill}`} style={{ width: `${share * 100}%` }} />}
        <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-500" />
      </div>
      {word && (
        <span
          aria-hidden="true"
          className={`shrink-0 text-xs font-semibold ${state === 'out' ? 'text-danger-700' : 'text-warning-800'}`}
        >
          {word}
        </span>
      )}
      <span className="sr-only">{description}</span>
    </div>
  )
}
