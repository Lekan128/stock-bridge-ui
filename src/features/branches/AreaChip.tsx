import { useRef, useState } from 'react'
import { ChevronDown, LayoutGrid } from 'lucide-react'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useToast } from '@/components/useToast'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { AreaMenu } from '@/features/branches/AreaMenu'
import { myAreas, useWorkArea } from '@/features/branches/workArea'

/**
 * Where in the branch this phone is, for someone placed in particular areas (STOCK_AREAS_PART_3.md,
 * STOCK_AREAS_PLAN.md §4.2), beside the branch: the cook's "Kitchen", as plain text; the barman's
 * "Bar ▾", a menu to switch to the front desk. Nothing for people in every area: they aren't at one, and
 * each sheet asks them. Switching is instant and quiet, like the branch.
 */
export function AreaChip() {
  const working = useOptionalWorkingBranch()?.working ?? null
  const work = useWorkArea(working)
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  if (!work.limited || work.areas.length === 0) return null
  const label = work.area?.name ?? 'Choose area'
  // Areas they work in that keep no figure (Housekeeping, or a Kitchen set that way): nothing to record
  // there, so not a choice - but said, so it doesn't look as if they were forgotten.
  const usesOnly = myAreas(working).filter((area) => !area.keepsStock)

  if (work.fixed) {
    return (
      <span className="flex max-w-[10rem] items-center gap-1.5 truncate rounded-md px-2 py-1 text-sm text-neutral-700" title={label} data-area-chip>
        <LayoutGrid className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex max-w-[10rem] items-center gap-1.5 rounded-md border px-2 py-1 text-sm ${
          open ? 'border-primary-200 bg-primary-100 text-neutral-800' : work.area ? 'border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50' : 'border-primary-300 bg-primary-50 text-primary-800'
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={work.area ? `Area: ${label}. Change area` : 'Choose area'}
        data-area-chip
      >
        <LayoutGrid className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
      </button>
      {open && (
        <AreaMenu
          areas={work.areas}
          currentId={work.area?.id}
          usesOnly={usesOnly}
          desktopClassName="sm:absolute sm:right-0 sm:mt-2"
          onClose={() => setOpen(false)}
          onPick={(area) => {
            setOpen(false)
            if (area.id === work.area?.id) return
            work.choose(area.id)
            showToast(`Now in the ${area.name}`, 'info')
          }}
        />
      )}
    </div>
  )
}
