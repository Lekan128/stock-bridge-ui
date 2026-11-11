import { useRef, useState } from 'react'
import { ChevronDown, LayoutGrid } from 'lucide-react'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useToast } from '@/components/useToast'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { AreaMenu } from '@/features/branches/AreaMenu'
import { ReceivedSheet } from '@/features/moves/ReceivedSheet'
import { hasAreas } from '@/features/branches/areas'
import { ALL_AREAS, myAreas, useWorkArea } from '@/features/branches/workArea'

/**
 * Where in the branch this phone is (STOCK_AREAS_PART_3.md, STOCK_AREAS_PART_3_6.md), beside the branch - what
 * the app shows and where it records, as the branch chooser is for branches. The cook's "Kitchen", as plain
 * text; everyone else "All my areas ▾" / "All areas ▾" or the area chosen, a menu to change it. Switching is
 * instant and quiet, like the branch.
 */
export function AreaChip() {
  const working = useOptionalWorkingBranch()?.working ?? null
  const work = useWorkArea(working)
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [givenOpen, setGivenOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  // Only at a branch with areas to choose from (none at a branch that hasn't added any, rule 1).
  if (!working || !hasAreas(working) || work.areas.length === 0) return null
  const allLabel = work.limited ? 'All my areas' : 'All areas'
  const label = work.area?.name ?? allLabel
  // Areas they work in that keep no figure (Housekeeping, or a Kitchen set that way): nothing to record
  // there, so not a choice - but said, so it doesn't look as if they were forgotten.
  const usesOnly = myAreas(working).filter((area) => !area.keepsStock)

  if (work.fixed) {
    return (
      <span className="flex max-w-[10rem] items-center gap-1.5 truncate rounded-md px-2 py-1 text-sm text-neutral-700" title={label} data-area-chip>
        <LayoutGrid className="hidden h-4 w-4 shrink-0 text-neutral-500 sm:block" aria-hidden />
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
          open ? 'border-primary-200 bg-primary-100 text-neutral-800' : 'border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50'
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Area: ${label}. Change area`}
        data-area-chip
      >
        <LayoutGrid className="hidden h-4 w-4 shrink-0 text-neutral-500 sm:block" aria-hidden />
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
      </button>
      {open && (
        <AreaMenu
          areas={work.areas}
          currentId={work.area?.id}
          usesOnly={usesOnly}
          caption="Showing and recording"
          all={{
            label: allLabel,
            current: !work.area,
            onPick: () => {
              setOpen(false)
              if (!work.area) return
              work.choose(ALL_AREAS)
              showToast(`Now showing ${allLabel.toLowerCase()}`, 'info')
            },
          }}
          className="fixed inset-x-4 top-[4.5rem] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-64"
          onGiveBack={() => {
            setOpen(false)
            setGivenOpen(true)
          }}
          onPick={(area) => {
            setOpen(false)
            if (area.id === work.area?.id) return
            work.choose(area.id)
            showToast(`Now in the ${area.name}`, 'info')
          }}
        />
      )}
      {givenOpen && <ReceivedSheet onClose={() => setGivenOpen(false)} />}
    </div>
  )
}
