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
  caption = 'Record in',
  all,
  onGiveBack,
}: {
  areas: Area[]
  currentId: string | undefined
  /** What the choice does: "Record in" (quick mode), "Showing and recording" (the top bar). */
  caption?: string
  /** "All my areas" / "All areas" first (the top bar, Part 3.6): its words, whether it's chosen, and picking it. */
  all?: { label: string; current: boolean; onPick: () => void }
  /** Areas they work in that use what they're given: said, so they don't look forgotten. */
  usesOnly?: Area[]
  onPick: (area: Area) => void
  /** Where the dropdown sits, under whatever opened it. */
  className: string
  /** "Give back or report" under the areas that use stock up (Part 6): what there is to do for them. */
  onGiveBack?: () => void
}) {
  return (
    <div
      role="menu"
      aria-label={caption}
      className={`z-50 flex max-h-[min(28rem,70vh)] flex-col rounded-lg border border-neutral-200 bg-white pb-1 text-left font-normal shadow-lg ${className}`}
    >
      <p role="none" className="shrink-0 px-3 pt-2.5 pb-1 text-xs font-medium text-neutral-600">
        {caption}
      </p>
      <div role="none" className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-1">
        {all && <MenuRow label={all.label} current={all.current} onPick={all.onPick} />}
        {areas.map((area) => (
          <MenuRow key={area.id} label={area.name} current={currentId === area.id} onPick={() => onPick(area)} />
        ))}
      </div>
      {usesOnly.length > 0 && (
        <p role="none" className="mx-3 mt-1 border-t border-neutral-100 pt-2 pb-1 text-xs text-neutral-600">
          {usesOnly.map((area) => area.name).join(' and ')}{' '}
          {usesOnly.length === 1 ? 'uses' : 'use'} stock up as soon as it arrives, so there's nothing to record there.
          {onGiveBack && (
            <>
              {' '}
              <button
                type="button"
                role="menuitem"
                onClick={onGiveBack}
                className="inline-flex min-h-11 items-center font-medium text-primary-700 hover:underline"
              >
                Give back or report
              </button>
            </>
          )}
        </p>
      )}
    </div>
  )
}

function MenuRow({ label, current, onPick }: { label: string; current: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={current}
      onClick={onPick}
      className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-base sm:text-sm ${
        current ? 'bg-primary-50 font-medium text-primary-800' : 'text-neutral-800 hover:bg-neutral-50'
      }`}
    >
      <span className="min-w-0 break-words">{label}</span>
      {current && <Check className="h-4 w-4 shrink-0 text-primary-700" aria-hidden />}
    </button>
  )
}
