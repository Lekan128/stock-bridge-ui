import { Check } from 'lucide-react'
import type { Area } from '@/features/branches/types'

/**
 * "Record in" - the areas to choose from, the one chosen highlighted (owner, 2026-10-31: the caption says
 * what the choice does). The one menu behind the top bar's area chip and quick mode's title, so both read and
 * change the same thing the same way. A dropdown under whatever opened it, on a phone too (owner, 2026-10-31:
 * tapped at the top, it opens at the top), placed by `className`.
 */
export function AreaMenu({
  areas,
  currentId,
  usesOnly = [],
  onPick,
  className,
}: {
  areas: Area[]
  currentId: string | undefined
  /** Areas they work in that use what they're given: said, so they don't look forgotten. */
  usesOnly?: Area[]
  onPick: (area: Area) => void
  /** Where the dropdown sits, under whatever opened it. */
  className: string
}) {
  return (
    <div
      role="menu"
      aria-label="Record in"
      className={`z-50 flex max-h-[min(28rem,70vh)] flex-col rounded-lg border border-neutral-200 bg-white pb-1 text-left font-normal shadow-lg ${className}`}
    >
      <p role="none" className="shrink-0 px-3 pt-2.5 pb-1 text-xs font-medium text-neutral-600">
        Record in
      </p>
      <div role="none" className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-1">
        {areas.map((area) => {
          const current = currentId === area.id
          return (
            <button
              key={area.id}
              type="button"
              role="menuitemradio"
              aria-checked={current}
              onClick={() => onPick(area)}
              className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-base sm:text-sm ${
                current ? 'bg-primary-50 font-medium text-primary-800' : 'text-neutral-800 hover:bg-neutral-50'
              }`}
            >
              <span className="min-w-0 break-words">{area.name}</span>
              {current && <Check className="h-4 w-4 shrink-0 text-primary-700" aria-hidden />}
            </button>
          )
        })}
      </div>
      {usesOnly.length > 0 && (
        <p role="none" className="mx-3 mt-1 border-t border-neutral-100 pt-2 pb-1 text-xs text-neutral-600">
          {usesOnly.map((area) => area.name).join(' and ')}{' '}
          {usesOnly.length === 1 ? "uses what it's given" : "use what they're given"}, so there's nothing to record there.
        </p>
      )}
    </div>
  )
}
