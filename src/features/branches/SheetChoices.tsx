import type { Area, Branch } from '@/features/branches/types'

/** A row of choices, one selected - the sheet's branch or area. */
export function SheetChoices({
  labelledBy,
  options,
  chosen,
  onChoose,
  waiting,
}: {
  labelledBy: string
  options: (Branch | Area)[]
  chosen: string | null
  onChoose: (id: string) => void
  /** Sales waiting at an option (the till, owner 2026-11-18): a small count on its chip. */
  waiting?: Record<string, number>
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={chosen === option.id}
          onClick={() => onChoose(option.id)}
          className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm ${
            chosen === option.id
              ? 'border-primary-600 bg-primary-50 font-medium text-primary-700'
              : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          {option.name}
          {(waiting?.[option.id] ?? 0) > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning-100 px-1.5 text-xs font-semibold text-warning-900 tabular-nums">
              {waiting![option.id]}
              <span className="sr-only"> {waiting![option.id] === 1 ? 'sale' : 'sales'} waiting</span>
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
