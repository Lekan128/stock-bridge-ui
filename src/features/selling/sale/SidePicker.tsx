import { formatNumber } from '@/features/products/unitCopy'

/** A meal a side can go with: a line of the sale or bill, sent already or not. */
export interface Meal {
  key: string
  name: string
  /** A new line of several: choosing it makes one of them its own plate. */
  quantity: number
  sent: boolean
  note?: string
}

/**
 * "Banana chips goes with" (V99; on the counter too, V109): each meal in the sale or on the bill - one of several of
 * the same as its own plate - or "On its own". Shown in place of the product buttons, never a popup.
 */
export function SidePicker({ side, meals, onPick, onBack }: { side: string; meals: Meal[]; onPick: (meal: Meal | null) => void; onBack: () => void }) {
  const seen = new Map<string, number>()
  const total = new Map<string, number>()
  for (const meal of meals) total.set(meal.name, (total.get(meal.name) ?? 0) + meal.quantity)
  const ordinal = (n: number) => ['1st', '2nd', '3rd'][n - 1] ?? `${n}th`
  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-primary-600 bg-primary-50 p-3" role="group" aria-label={`${side} goes with`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold text-neutral-900">{side} goes with</p>
        <button type="button" onClick={onBack} className="text-sm font-semibold text-primary-700 hover:underline">
          Back
        </button>
      </div>
      {meals.flatMap((meal) =>
        Array.from({ length: Math.max(1, meal.sent ? 1 : meal.quantity) }, (_, index) => {
          const n = (seen.get(meal.name) ?? 0) + 1
          seen.set(meal.name, n)
          const many = (total.get(meal.name) ?? 1) > 1
          const extra = [many ? (meal.sent && meal.quantity > 1 ? `one of ${formatNumber(meal.quantity)}` : ordinal(n)) : null, meal.note, meal.sent ? 'sent' : null]
            .filter(Boolean)
            .join(' · ')
          return (
            <button
              key={`${meal.key}-${index}`}
              type="button"
              onClick={() => onPick(meal)}
              className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-3 text-left text-sm font-semibold text-neutral-900 hover:border-primary-600"
            >
              <span>{meal.name}</span>
              <span className="text-xs font-normal text-neutral-500">{extra}</span>
            </button>
          )
        }),
      )}
      <button
        type="button"
        onClick={() => onPick(null)}
        className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-dashed border-neutral-300 bg-white px-3 text-left text-sm text-neutral-600"
      >
        <span>On its own</span>
        <span className="text-xs">a side ordered by itself</span>
      </button>
    </div>
  )
}
