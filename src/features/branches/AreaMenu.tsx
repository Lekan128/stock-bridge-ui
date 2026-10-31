import { Check } from 'lucide-react'
import type { Area } from '@/features/branches/types'

/**
 * "Record in" - the areas to choose from, the one chosen highlighted (owner, 2026-10-31: the caption says
 * what the choice does). The one menu behind the top bar's area chip and quick mode's title, so both read and
 * change the same thing the same way - and it opens as the branch chooser does: a sheet from the bottom on a
 * phone, over a dimmed screen; a dropdown on a laptop, placed by `desktopClassName`.
 */
export function AreaMenu({
  areas,
  currentId,
  usesOnly = [],
  onPick,
  onClose,
  desktopClassName,
}: {
  areas: Area[]
  currentId: string | undefined
  /** Areas they work in that use what they're given: said, so they don't look forgotten. */
  usesOnly?: Area[]
  onPick: (area: Area) => void
  onClose: () => void
  /** Where the dropdown sits from `sm` up, beside whatever opened it. */
  desktopClassName: string
}) {
  return (
    <>
      <div aria-hidden className="fixed inset-0 z-40 bg-neutral-900/30 sm:hidden" onClick={onClose} />
      <div
        role="menu"
        aria-label="Record in"
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-2xl border-t border-neutral-200 bg-white pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-left font-normal shadow-lg sm:inset-x-auto sm:bottom-auto sm:max-h-[min(28rem,70vh)] sm:w-64 sm:rounded-lg sm:border sm:pb-1 ${desktopClassName}`}
      >
        <p role="none" className="shrink-0 px-4 pt-4 pb-2 text-base font-semibold text-neutral-900 sm:px-3 sm:pt-2.5 sm:pb-1 sm:text-xs sm:font-medium sm:text-neutral-600">
          Record in
        </p>
        <div role="none" className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-2 sm:px-1">
          {areas.map((area) => {
            const current = currentId === area.id
            return (
              <button
                key={area.id}
                type="button"
                role="menuitemradio"
                aria-checked={current}
                onClick={() => onPick(area)}
                className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-base sm:min-h-10 sm:text-sm ${
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
          <p role="none" className="mx-4 mt-2 border-t border-neutral-100 pt-2 pb-1 text-xs text-neutral-600 sm:mx-3">
            {usesOnly.map((area) => area.name).join(' and ')}{' '}
            {usesOnly.length === 1 ? "uses what it's given" : "use what they're given"}, so there's nothing to record there.
          </p>
        )}
      </div>
    </>
  )
}
