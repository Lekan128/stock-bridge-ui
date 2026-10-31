import { useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/Button'
import { AREA_KINDS, hasAreas, kindOf } from '@/features/branches/areas'
import { AreaEditSheet } from '@/features/branches/AreaEditSheet'
import type { Area, Branch } from '@/features/branches/types'

/**
 * A branch's areas on the Branches page (STOCK_AREAS_PLAN.md §4.1, §5.8), as rows under the branch's own
 * line - ruled, not a box inside its card (DESIGN.md: "rules and columns first"). "Add areas" sits by the
 * heading. Each row says the area in words - what it holds, what happens there, where deliveries arrive -
 * and tapping it opens its one Edit panel (owner, 2026-10-31: one way to change an area, like the branch's
 * own Edit; where deliveries arrive is the branch's setting, in its Edit). A branch that hasn't added any
 * shows its Store as it is, holding everything (owner, 2026-10-30): this page is the one exception to rule
 * 1, being for owners and managers. Online only, like the rest of the page.
 */
export function BranchAreas({
  branch,
  online,
  mayAddArea,
  onAddAreas,
}: {
  branch: Branch
  online: boolean
  mayAddArea: boolean
  onAddAreas: () => void
}) {
  const [editing, setEditing] = useState<Area | null>(null)
  // Changing an area is for someone who works at the branch (the server checks it again).
  const mayChange = branch.active && branch.canRecord
  const areas = branch.areas ?? []
  const withAreas = hasAreas(branch)
  // Only where areas can be added, or already have been: for a seller the Store alone would be noise.
  if (areas.length === 0 || (!withAreas && !mayAddArea)) return null

  /** The area in a line: "25 products · stock is kept here · deliveries arrive here", "Closed". */
  function describe(area: Area): string {
    if (!withAreas) return 'where all your stock is now · deliveries arrive here'
    const parts: string[] = []
    if (!area.active) parts.push('Closed')
    if (area.keepsStock && area.productsInStock != null) {
      parts.push(`${area.productsInStock} ${area.productsInStock === 1 ? 'product' : 'products'}`)
    }
    parts.push(AREA_KINDS[kindOf(area)].short)
    if (area.delivery) parts.push('deliveries arrive here')
    return parts.join(' · ')
  }

  return (
    <section aria-label={`Areas at ${branch.name}`} className="border-t border-neutral-100 pt-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">Areas</h3>
        {mayAddArea && mayChange && (
          <Button variant="secondary" onClick={onAddAreas} disabled={!online}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {online ? (withAreas ? 'Add an area' : 'Add areas') : 'Add areas when online'}
          </Button>
        )}
      </div>
      <ul className="mt-2 divide-y divide-neutral-100">
        {areas.map((area) => {
          const line = (
            <span className={`min-w-0 flex-1 text-sm ${area.active ? '' : 'opacity-70'}`}>
              <span className="font-medium text-neutral-900">{area.name}</span>
              <span className="block text-neutral-600 sm:inline">
                <span className="hidden sm:inline"> · </span>
                {describe(area)}
              </span>
            </span>
          )
          return (
            <li key={area.id} data-area={area.name}>
              {mayChange ? (
                // The whole row opens the area's Edit: one way to change it.
                <button
                  type="button"
                  onClick={() => setEditing(area)}
                  disabled={!online}
                  aria-label={`Edit ${area.name}`}
                  className="-mx-2 flex min-h-12 w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-neutral-50 disabled:cursor-not-allowed"
                >
                  {line}
                  <ChevronRight className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
                </button>
              ) : (
                <div className="flex min-h-12 items-center py-2">{line}</div>
              )}
            </li>
          )
        })}
      </ul>
      {editing && <AreaEditSheet area={editing} withAreas={withAreas} onClose={() => setEditing(null)} />}
    </section>
  )
}

