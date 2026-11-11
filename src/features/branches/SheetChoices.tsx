import type { Area, Branch } from '@/features/branches/types'

/** A row of choices, one selected - the sheet's branch or area. */
export function SheetChoices({
  labelledBy,
  options,
  chosen,
  onChoose,
}: {
  labelledBy: string
  options: (Branch | Area)[]
  chosen: string | null
  onChoose: (id: string) => void
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
          className={`rounded-md border px-3 py-1.5 text-sm ${
            chosen === option.id
              ? 'border-primary-600 bg-primary-50 font-medium text-primary-700'
              : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          {option.name}
        </button>
      ))}
    </div>
  )
}
