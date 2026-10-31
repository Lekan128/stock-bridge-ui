import { Check } from 'lucide-react'
import type { Area } from '@/features/branches/types'

const itemClassName =
  'flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 focus-visible:bg-neutral-50'

/**
 * "Where are you working on this phone?" - the areas to pick from, the current one ticked, and a quiet line
 * for the person's areas that keep no figure (nothing to record there). The one menu behind the top bar's
 * area chip and quick mode's title, so both read and change the same thing the same way.
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
  className: string
}) {
  return (
    <div role="menu" aria-label="Where are you working on this phone?" className={`z-50 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg ${className}`}>
      <p role="none" className="px-3 pt-2 pb-1 text-xs font-medium text-neutral-600">
        Where are you working on this phone?
      </p>
      {areas.map((area) => {
        const current = currentId === area.id
        return (
          <button
            key={area.id}
            type="button"
            role="menuitemradio"
            aria-checked={current}
            onClick={() => onPick(area)}
            className={itemClassName}
          >
            <Check className={`h-4 w-4 shrink-0 ${current ? 'text-primary-600' : 'invisible'}`} aria-hidden />
            <span className="min-w-0 break-words">{area.name}</span>
          </button>
        )
      })}
      {usesOnly.length > 0 && (
        <p role="none" className="border-t border-neutral-100 px-3 pt-2 pb-2.5 text-xs text-neutral-600">
          {usesOnly.map((area) => area.name).join(' and ')}{' '}
          {usesOnly.length === 1 ? "uses what it's given" : "use what they're given"}, so there's nothing to record there.
        </p>
      )}
    </div>
  )
}
